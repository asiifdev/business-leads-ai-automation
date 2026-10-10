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
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) return isBlockedAddress(v.slice(7)); // IPv4-mapped
    if (/^f[cd]/.test(v)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(v)) return true; // fe80::/10 link-local
    if (v.startsWith("ff")) return true; // multicast
    return false;
  }
  if (!net.isIPv4(ip)) return true;
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
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

/** Readable text from an HTML page: title, description, headings, paragraphs and list items. Scripts, styles and page chrome are dropped. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim());
  const meta = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"))?.[1] ?? "";
  const description = decodeEntities((meta("description") || meta("og:description")).trim());

  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template|nav|footer|form|select|button)\b[\s\S]*?<\/\1>/gi, " ");
  body = body
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|ul|ol|table|blockquote|br)\s*>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, "\n## ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");
  body = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l, i, arr) => l && l !== arr[i - 1]) // drop empty lines and immediate repeats (menus)
    .join("\n");

  const parts = [title && `# ${title}`, description, body].filter(Boolean).join("\n\n");
  return { title, text: parts.slice(0, MAX_TEXT_CHARS) };
}

async function readLimited(body: ReadableStream<Uint8Array> | null, maxBytes = MAX_BYTES): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BadRequestException("That file is too large to read");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export interface FetchedResource {
  url: string;
  type: string;
  body: string;
}

/**
 * Fetches one public resource with every safety limit applied (public addresses only, redirects re-validated,
 * size and time caps, content-type allow-list). Returns the raw body.
 */
export async function fetchResource(rawUrl: string, opts: { types?: RegExp; maxBytes?: number } = {}): Promise<FetchedResource> {
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
        headers: { "user-agent": "ProspexBot/1.0 (+https://github.com/asiifdev/business-leads-ai-automation)", accept: "text/html,text/plain,text/markdown,application/xml,text/xml;q=0.9,*/*;q=0.1" },
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
    const body = await readLimited(res.body as ReadableStream<Uint8Array> | null, maxBytes);
    return { url: url.toString(), type, body };
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
