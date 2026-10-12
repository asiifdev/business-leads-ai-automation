import { fetchResource, pageTextFromHtml, type PageText } from "./url-fetch";

/**
 * Reads a website the way a person would to understand a business: not only the address that was given, but the pages
 * the site itself points to (llms.txt, sitemap.xml, robots.txt, links on the home page). One page alone invites guessing,
 * which is how a brief ends up with invented claims.
 */

export interface CrawlOptions {
  maxPages?: number;
  deadlineMs?: number;
  /** Renders a page with a real browser; used only when the plain HTML has almost no text. */
  render?: (url: string) => Promise<{ html: string; url: string }>;
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  rendered: boolean;
  /** Where the page came from: the given address, llms.txt, the sitemap or a link on the home page. */
  via: "given" | "llms" | "sitemap" | "link";
}

export interface CrawlResult {
  origin: string;
  pages: CrawledPage[];
  discovered: number;
  notes: string[];
  failed: { url: string; reason: string }[];
}

const MAX_PAGE_CHARS = 9_000;
const HOME_PAGE_CHARS = 12_000;
const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|rar|mp4|mp3|css|js|json|xml|txt|woff2?|ttf|docx?|xlsx?|pptx?)$/i;
const SKIP_PATH = /(\/wp-(json|admin|content|login)|\/feed\/?$|\/tag\/|\/category\/|\/author\/|\/page\/\d+|\/cart|\/checkout|\/login|\/register|\/signin|\/signup|\/my-account|\/cdn-cgi\/|\/search\b)/i;
const BLOGLIKE = /\/(blog|artikel|articles?|news|berita|post|posts)\b/i;
const HIGH = /(^|\/)(about|tentang|company|profil|profile|layanan|services?|jasa|produk|products?|solusi|solutions?|fitur|features?|harga|pricing|paket|plans?|faq|pertanyaan|cara-kerja|how-it-works|portfolio|portofolio|case-stud|studi-kasus|klien|clients?|testimoni|testimonials?)/i;
const MEDIUM = /(^|\/)(kontak|contact|hubungi|demo|download|unduh|tim|team|karir|career)/i;

const stripWww = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** A same-site, crawl-worthy URL without hash and query, or null. */
export function normalizeCandidate(raw: string, base: URL): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || stripWww(u.hostname) !== stripWww(base.hostname)) return null;
  u.hash = "";
  u.search = "";
  if (SKIP_EXT.test(u.pathname) || SKIP_PATH.test(u.pathname)) return null;
  const path = u.pathname.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
  return `${base.origin}${path}`; // always the host that was given, so www and bare duplicates collapse
}

export function parseSitemapXml(xml: string): { urls: string[]; sitemaps: string[]; isIndex: boolean } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  const isIndex = /<sitemapindex/i.test(xml);
  return isIndex ? { urls: [], sitemaps: locs, isIndex } : { urls: locs, sitemaps: [], isIndex };
}

/** Links in an llms.txt file: markdown links and bare URLs, resolved against the site. */
export function parseLlmsLinks(text: string, base: URL): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\[[^\]\n]{0,200}\]\(([^)\s]{1,500})\)/g)) found.add(m[1]);
  for (const m of text.matchAll(/https?:\/\/[^\s)>\]"']{1,500}/g)) found.add(m[0].replace(/[.,;]+$/, ""));
  return [...found].map((u) => normalizeCandidate(u, base)).filter((u): u is string => !!u);
}

export function robotsSitemaps(robots: string): string[] {
  return [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
}

export function scoreUrl(url: string, startUrl: string): number {
  const path = new URL(url).pathname;
  if (url === startUrl || path === "/" || path === "") return 100;
  let s = 0;
  if (HIGH.test(path)) s += 40;
  else if (MEDIUM.test(path)) s += 20;
  if (BLOGLIKE.test(path)) s -= 15;
  const depth = path.split("/").filter(Boolean).length;
  s -= depth * 4; // top-level pages describe the business; deep ones are details
  if (/-?(copy|test|draft|sample)\b/i.test(path)) s -= 30;
  return s;
}

/** Picks the pages worth reading: best-scored first, a few blog posts at most, never the same page twice. */
export function selectPages(candidates: string[], startUrl: string, max: number, maxBlog = 4): string[] {
  const unique = [...new Set(candidates)];
  const ranked = unique.sort((a, b) => scoreUrl(b, startUrl) - scoreUrl(a, startUrl));
  const out: string[] = [];
  let blog = 0;
  for (const u of ranked) {
    if (BLOGLIKE.test(new URL(u).pathname)) {
      if (blog >= maxBlog) continue;
      blog++;
    }
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

async function tryFetchText(url: string, maxBytes = 3_000_000): Promise<string | null> {
  try {
    const r = await fetchResource(url, { types: /^(text\/|application\/(xml|xhtml\+xml)|application\/octet-stream)/i, maxBytes });
    return r.body;
  } catch {
    return null;
  }
}

/** One readable line for the user: no browser internals, no call logs. */
export function friendlyReason(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/ERR_BLOCKED_BY_CLIENT|blockedbyclient|not allowed/i.test(m)) return "that address is not allowed";
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/i.test(m)) return "the address could not be found";
  if (/timeout|timed out/i.test(m)) return "the page took too long to open";
  return m.split("\n")[0].replace(/^(page\.goto|browserType\.launch): /, "").slice(0, 140);
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function crawlSite(inputUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 10;
  const deadline = Date.now() + (opts.deadlineMs ?? 75_000);
  const start = new URL(inputUrl);
  const startNorm = normalizeCandidate(start.toString(), start) ?? start.origin;
  const origin = start.origin;
  const notes: string[] = [];
  const via = new Map<string, CrawledPage["via"]>([[startNorm, "given"]]);
  const add = (urls: string[], how: CrawledPage["via"]) => urls.forEach((u) => !via.has(u) && via.set(u, how));

  // 1. what the site says about itself: llms.txt
  const pages: CrawledPage[] = [];
  for (const name of ["llms.txt", "llms-full.txt"]) {
    const body = await tryFetchText(`${origin}/${name}`, 2_000_000);
    if (body && body.trim().length > 50 && !/<html/i.test(body.slice(0, 500))) {
      pages.push({ url: `${origin}/${name}`, title: name, text: body.slice(0, MAX_PAGE_CHARS), rendered: false, via: "llms" });
      add(parseLlmsLinks(body.slice(0, 400_000), start), "llms");
      notes.push(`${name} found`);
    }
  }

  // 2. the sitemap(s)
  const sitemapUrls = new Set<string>(`${origin}/sitemap.xml`.split("\n"));
  const robots = await tryFetchText(`${origin}/robots.txt`, 200_000);
  if (robots) robotsSitemaps(robots).forEach((u) => sitemapUrls.add(u));
  sitemapUrls.add(`${origin}/sitemap_index.xml`);
  const seenMaps = new Set<string>();
  const queue = [...sitemapUrls];
  let sitemapHits = 0;
  while (queue.length && seenMaps.size < 6 && Date.now() < deadline) {
    const u = queue.shift()!;
    if (seenMaps.has(u)) continue;
    seenMaps.add(u);
    let sm: URL;
    try {
      sm = new URL(u);
    } catch {
      continue;
    }
    if (stripWww(sm.hostname) !== stripWww(start.hostname)) continue;
    const xml = await tryFetchText(u);
    if (!xml || !/<(urlset|sitemapindex)/i.test(xml)) continue;
    const parsed = parseSitemapXml(xml);
    queue.push(...parsed.sitemaps);
    const urls = parsed.urls.slice(0, 500).map((x) => normalizeCandidate(x, start)).filter((x): x is string => !!x);
    sitemapHits += urls.length;
    add(urls, "sitemap");
  }
  if (sitemapHits) notes.push(`sitemap: ${sitemapHits} pages listed`);

  // 3. fall back to the links on the home page when the site gives no map of itself
  let homeHtml: string | null = null;
  if (via.size < 6) {
    homeHtml = await tryFetchText(startNorm);
    if (homeHtml) {
      const links = [...homeHtml.slice(0, 400_000).matchAll(/<a\s[^>]{0,400}?href=["']([^"'#\s]{1,500})["']/gi)].map((m) => normalizeCandidate(m[1], start)).filter((x): x is string => !!x);
      add(links, "link");
      notes.push(`no usable sitemap: used ${new Set(links).size} links from the home page`);
    }
  }

  const chosen = selectPages([...via.keys()], startNorm, maxPages);
  if (!chosen.includes(startNorm)) chosen.unshift(startNorm);

  // 4. read them (plain HTML first, a real browser when the page builds its text with JavaScript)
  const failed: { url: string; reason: string }[] = [];
  const results = await pool(chosen.slice(0, maxPages), 3, async (url): Promise<CrawledPage | null> => {
    if (Date.now() > deadline) {
      failed.push({ url, reason: "time limit" });
      return null;
    }
    let page: PageText | null = null;
    try {
      const r = await fetchResource(url);
      if (/html/i.test(r.type)) page = pageTextFromHtml(r.url, r.body);
      else page = { url: r.url, title: new URL(r.url).hostname, text: r.body.slice(0, MAX_PAGE_CHARS), thin: false };
    } catch (e) {
      if (!opts.render) failed.push({ url, reason: friendlyReason(e) });
    }
    let rendered = false;
    if ((!page || page.thin) && opts.render) {
      try {
        const r = await opts.render(url);
        const p = pageTextFromHtml(r.url, r.html);
        if (!page || p.text.length > page.text.length) {
          page = p;
          rendered = true;
        }
      } catch (e) {
        if (!page) failed.push({ url, reason: friendlyReason(e) });
      }
    }
    if (!page || page.text.replace(/\s+/g, " ").length < 120) {
      if (page) failed.push({ url, reason: "almost no text" });
      return null;
    }
    const cap = url === startNorm ? HOME_PAGE_CHARS : MAX_PAGE_CHARS;
    return { url: page.url, title: page.title, text: page.text.slice(0, cap), rendered, via: via.get(url) ?? "link" };
  });

  // drop near-duplicates (language variants, trailing-slash twins)
  const seenText = new Set<string>();
  for (const r of results) {
    if (!r) continue;
    const key = r.text.slice(0, 300).toLowerCase().replace(/\s+/g, " ");
    if (seenText.has(key)) continue;
    seenText.add(key);
    pages.push(r);
  }
  return { origin, pages, discovered: via.size, notes, failed };
}

/** One text block for a whole site, with a header per page, ready to be stored as a source. */
export function siteToText(result: CrawlResult): string {
  return result.pages.map((p) => `## Halaman: ${p.title} (${p.url})\n${p.text}`).join("\n\n");
}
