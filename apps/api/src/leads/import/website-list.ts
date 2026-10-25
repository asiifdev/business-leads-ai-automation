/**
 * A pasted list of websites to turn into leads. Addresses are cleaned and checked for shape here; whether they may be opened (public
 * addresses only) is decided by the safe fetcher when they are read. Pure and bounded.
 */
import { websiteDomain } from "../dedupe";
import { platformOf } from "../profile-meta";

export const MAX_WEBSITES = 200;
const MAX_TEXT = 40_000;

export interface WebsiteListParse {
  urls: string[];
  /** The first few entries that are not web addresses. */
  invalid: string[];
  duplicates: number;
  /** Link pages, marketplaces and social sites other than Instagram and Facebook: they are not a business's own page. */
  unsupported: number;
  truncated: boolean;
}

export function parseWebsiteList(input: string): WebsiteListParse {
  const out: WebsiteListParse = { urls: [], invalid: [], duplicates: 0, unsupported: 0, truncated: false };
  const seen = new Set<string>();
  for (const raw of input.slice(0, MAX_TEXT).split(/[\s,;|]+/)) {
    const token = raw.replace(/^[<("'\[]+|[>)"'\].,]+$/g, "");
    if (!token) continue;
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(token) ? token : `https://${token}`);
    } catch {
      if (out.invalid.length < 5) out.invalid.push(token.slice(0, 60));
      continue;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || url.username || url.password || token.length > 300) {
      if (out.invalid.length < 5) out.invalid.push(token.slice(0, 60));
      continue;
    }
    const profile = platformOf(url.toString());
    // A business's own site is identified by its domain; an Instagram or Facebook page by its address.
    if (!profile && websiteDomain(url.toString()) === null) { out.unsupported++; continue; }
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|igsh)/i.test(k)) url.searchParams.delete(k);
    url.hash = "";
    const key = profile ? `${profile}:${url.pathname.replace(/\/+$/, "").toLowerCase()}` : host;
    if (seen.has(key)) { out.duplicates++; continue; }
    seen.add(key);
    if (out.urls.length >= MAX_WEBSITES) { out.truncated = true; continue; }
    out.urls.push(url.toString());
  }
  return out;
}

const GENERIC = /^(home|homepage|beranda|halaman utama|welcome|selamat datang|official( web)?site|website resmi|situs resmi|index|untitled|utama|main page)$/i;

/** The business name from a page: its structured data, else the site name, else the part of the title that is not "Home". */
export function businessNameFromPage(page: { jsonldName?: string; siteName?: string; title?: string }, url: string): string {
  const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  const direct = clean(page.jsonldName) || clean(page.siteName);
  if (direct && !GENERIC.test(direct)) return direct;
  const parts = clean(page.title).split(/\s+[|\-–—•·:]\s+/).map((p) => p.trim()).filter((p) => p.length >= 2 && !GENERIC.test(p));
  if (parts[0]) return parts[0].slice(0, 100);
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url.slice(0, 100); }
}
