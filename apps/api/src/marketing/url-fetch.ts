import { BadRequestException } from "@nestjs/common";
import * as dns from "node:dns";
import * as net from "node:net";
import { Agent, fetch } from "undici";

const MAX_BYTES = 2_000_000;
const MAX_TEXT_CHARS = 60_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;
const ALLOWED_TYPES = /^(text\/html|text\/plain|text\/markdown|application\/xhtml\+xml)\b/i;

/** True for addresses a server must never be tricked into calling: loopback, private, link-local (cloud metadata), CGNAT, multicast, unspecified, IPv6 equivalents. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const g = expandIPv6(ip);
    if (!g) return true;
    const embeddedV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
    if (zeros(0, 7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
    if (zeros(0, 5) && g[5] === 0xffff) return isBlockedAddress(embeddedV4(g[6], g[7])); // IPv4-mapped
    if (zeros(0, 4) && g[4] === 0xffff && g[5] === 0) return isBlockedAddress(embeddedV4(g[6], g[7])); // IPv4-translated (::ffff:0:a.b.c.d)
    if (zeros(0, 6)) return isBlockedAddress(embeddedV4(g[6], g[7])); // IPv4-compatible (deprecated)
    if (g[0] === 0x64 && g[1] === 0xff9b) { // NAT64: the IPv4 sits in the last 32 bits; the local-use /48 is all internal
      if (g[2] !== 0) return true;
      return isBlockedAddress(embeddedV4(g[6], g[7]));
    }
    if (g[0] === 0x2002) return isBlockedAddress(embeddedV4(g[1], g[2])); // 6to4
    if (g[0] === 0x2001 && g[1] < 0x200) return true; // 2001::/23: Teredo, benchmarking, ORCHID, other protocol assignments
    if (g[0] === 0x5f00) return true; // SRv6 segment identifiers
    if (g[0] === 0x3fff && g[1] < 0x1000) return true; // 3fff::/20 documentation
    if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentation
    if (g[0] === 0x100 && zeros(1, 4)) return true; // discard-only 100::/64
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
    if ((g[0] & 0xff00) === 0xff00) return true; // multicast
    return false;
  }
  if (!net.isIPv4(ip)) return true;
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // 192.0.0.0/24 and 192.0.2.0/24
    (a === 192 && b === 88 && c === 99) || // 6to4 relay
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || // documentation
    a >= 224 // multicast and reserved
  );
}

/** Eight 16-bit groups of an IPv6 address (handles "::" and a dotted IPv4 tail), or null if it does not parse. */
function expandIPv6(ip: string): number[] | null {
  let v = ip.toLowerCase().split("%")[0];
  const dotted = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const p = dotted[1].split(".").map(Number);
    if (p.some((n) => n > 255)) return null;
    v = v.slice(0, -dotted[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
  }
  const halves = v.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const all = [...head, ...Array(fill).fill("0"), ...tail];
  if (all.length !== 8) return null;
  const out = all.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

/** Syntax-level checks that need no network. Throws a user-readable error. */
export function validatePublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new BadRequestException("That is not a valid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BadRequestException("Only http and https links are supported");
  if (u.username || u.password) throw new BadRequestException("Links with a username or password are not supported");
  if (u.port && !["80", "443"].includes(u.port)) throw new BadRequestException("Only the standard web ports (80, 443) are supported");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new BadRequestException("Local addresses are not allowed");
  if (net.isIP(host.replace(/^\[|\]$/g, "")) && isBlockedAddress(host.replace(/^\[|\]$/g, ""))) throw new BadRequestException("That address is not allowed");
  return u;
}

/**
 * DNS lookup that refuses private targets at connection time. Checking the name once and connecting later would leave a
 * window for DNS rebinding, so the check happens inside the lookup the socket actually uses.
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) {
      return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 0);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

const agent = new Agent({ connect: { lookup: safeLookup }, headersTimeout: TIMEOUT_MS, bodyTimeout: TIMEOUT_MS });

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

const SKIP_ELEMENTS = new Set(["script", "style", "noscript", "svg", "iframe", "template", "nav", "footer", "form", "select", "button", "head", "object", "embed", "canvas"]);
const BREAK_AFTER = new Set(["p", "div", "section", "article", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "blockquote", "header", "main", "aside", "dd", "dt", "figcaption", "br"]);
const MAX_HTML_CHARS = 2_000_000;
const MAX_TAG_CHARS = 4_096;

/**
 * Readable text from an HTML page: title, description, headings, paragraphs and list items. Scripts, styles and page
 * chrome are dropped. This is a single linear pass: every search moves forward and never restarts, so crafted HTML
 * (thousands of unclosed tags, huge comments) cannot make it quadratic, and the output is capped while it is built.
 */
export function htmlToText(rawHtml: string): { title: string; text: string } {
  const html = rawHtml.length > MAX_HTML_CHARS ? rawHtml.slice(0, MAX_HTML_CHARS) : rawHtml;
  const lower = html.toLowerCase();
  const head = html.slice(0, 80_000);

  const t0 = lower.indexOf("<title");
  let title = "";
  if (t0 >= 0 && t0 < 80_000) {
    const open = lower.indexOf(">", t0);
    const close = open >= 0 ? lower.indexOf("</title", open) : -1;
    if (open >= 0 && close >= 0 && close - open < 1_000) title = decodeEntities(html.slice(open + 1, close).replace(/\s+/g, " ").trim());
  }
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]{0,400}?(?:name|property)=["']${name}["'][^>]{0,400}?content=["']([^"']{0,600})["']|<meta[^>]{0,400}?content=["']([^"']{0,600})["'][^>]{0,400}?(?:name|property)=["']${name}["']`, "i");
    const m = head.match(re);
    return m ? (m[1] ?? m[2] ?? "") : "";
  };
  const description = decodeEntities((meta("description") || meta("og:description")).trim());

  const out: string[] = [];
  let size = 0;
  const push = (s: string) => {
    out.push(s);
    size += s.length;
  };
  const n = html.length;
  let i = 0;
  while (i < n && size < MAX_TEXT_CHARS * 3) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      push(html.slice(i));
      break;
    }
    if (lt > i) push(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    let j = lt + 1;
    const closing = html[j] === "/";
    if (closing) j++;
    let k = j;
    while (k < n && k - j < 20 && /[a-zA-Z0-9]/.test(html[k])) k++;
    const name = lower.slice(j, k);
    // a tag ends within a few KB or it is not a tag: bounding the search keeps the whole pass linear
    const gtRel = name ? html.slice(k, k + MAX_TAG_CHARS).indexOf(">") : -1;
    const gt = gtRel < 0 ? -1 : k + gtRel;
    if (!name || gt < 0) {
      // not a tag ("a < b"): keep the character and move on
      push("<");
      i = lt + 1;
      continue;
    }
    if (closing) {
      if (BREAK_AFTER.has(name)) push("\n");
      i = gt + 1;
      continue;
    }
    if (SKIP_ELEMENTS.has(name) && html[gt - 1] !== "/") {
      const close = lower.indexOf(`</${name}`, gt + 1);
      if (close < 0) break; // unclosed: everything after it belongs to the element
      const end = html.indexOf(">", close);
      i = end < 0 ? n : end + 1;
      continue;
    }
    if (/^h[1-6]$/.test(name)) push("\n## ");
    else if (name === "li") push("\n- ");
    else if (name === "br" || name === "hr") push("\n");
    i = gt + 1;
  }

  const body = decodeEntities(out.join(""))
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter((l, idx, arr) => l && l !== arr[idx - 1]) // drop empty lines and immediate repeats (menus)
    .join("\n");

  const parts = [title && `# ${title}`, description, body].filter(Boolean).join("\n\n");
  return { title, text: parts.slice(0, MAX_TEXT_CHARS) };
}

/** Reads at most `maxBytes`. Past that it refuses the file, or with `headOnly` stops and returns what it has (enough for a page'\''s head). */
export async function readLimitedBytes(body: ReadableStream<Uint8Array> | null, maxBytes = MAX_BYTES, headOnly = false): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      if (!headOnly) throw new BadRequestException("That file is too large to read");
      chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes))));
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export interface FetchedResource {
  url: string;
  type: string;
  body: string;
  /** The raw bytes, for images and other files. */
  bytes: Buffer;
}

/**
 * Fetches one public resource with every safety limit applied (public addresses only, redirects re-validated,
 * size and time caps, content-type allow-list). Returns the raw body.
 */
export async function fetchResource(rawUrl: string, opts: { types?: RegExp; maxBytes?: number; accept?: string; headOnly?: boolean } = {}): Promise<FetchedResource> {
  const types = opts.types ?? ALLOWED_TYPES;
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  let url = validatePublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await fetch(url.toString(), {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "ProspexBot/1.0 (+https://github.com/asiifdev/business-leads-ai-automation)", accept: opts.accept ?? "text/html,text/plain,text/markdown,application/xml,text/xml;q=0.9,*/*;q=0.1" },
      });
    } catch (e) {
      const code = (e as { cause?: { code?: string } }).cause?.code;
      if (code === "EBLOCKED") throw new BadRequestException("That address is not allowed");
      throw new BadRequestException("Could not open that link. Check the address, or paste the text instead.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = validatePublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new BadRequestException(`The page answered with status ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!types.test(type)) throw new BadRequestException("Only web pages and plain text are supported. Download other documents as .md or .txt and upload them.");
    const bytes = await readLimitedBytes(res.body as ReadableStream<Uint8Array> | null, maxBytes, opts.headOnly);
    return { url: url.toString(), type, body: bytes.toString("utf-8"), bytes };
  }
  throw new BadRequestException("Too many redirects");
}

export interface PageText {
  url: string;
  title: string;
  text: string;
  /** True when the page had almost no text in its HTML (typically a JavaScript app). */
  thin: boolean;
}

export const THIN_TEXT_CHARS = 600;

/** Turns fetched HTML (static or rendered by a browser) into page text. */
export function pageTextFromHtml(url: string, html: string): PageText {
  const { title, text } = htmlToText(html);
  return { url, title: title || new URL(url).hostname, text, thin: text.replace(/\s+/g, " ").length < THIN_TEXT_CHARS };
}

/** Fetches one public web page and returns its readable text (static HTML only). */
export async function fetchPublicPage(rawUrl: string): Promise<{ url: string; title: string; text: string }> {
  const r = await fetchResource(rawUrl);
  const page = /html/i.test(r.type) ? pageTextFromHtml(r.url, r.body) : { url: r.url, title: new URL(r.url).hostname, text: r.body.slice(0, MAX_TEXT_CHARS), thin: r.body.replace(/\s+/g, " ").length < 200 };
  if (page.text.replace(/\s+/g, " ").length < 200) {
    throw new BadRequestException("This page has almost no readable text (it may need JavaScript to show its content). Paste the text instead.");
  }
  return { url: page.url, title: page.title, text: page.text };
}

/** True when every address the host resolves to is public. Used to guard browser requests. */
export async function hostIsPublic(hostname: string): Promise<boolean> {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (net.isIP(h)) return !isBlockedAddress(h);
  try {
    const addrs = await dns.promises.lookup(h, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isBlockedAddress(a.address));
  } catch {
    return false;
  }
}
