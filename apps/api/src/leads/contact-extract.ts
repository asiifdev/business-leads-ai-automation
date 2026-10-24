/**
 * Pulls public contact details out of a business's own web pages. Only what is printed on the page is returned;
 * nothing is guessed (no pattern-based email guessing). All scans are bounded so hostile HTML cannot stall them.
 */
import { normalizePhone } from "../messaging/phone";

export interface ExtractedContacts {
  emails: string[];
  whatsapp: string[];
  /** wa.me/<username> links: a way to reach the business, but not a phone number. */
  whatsappHandles: string[];
  social: Partial<Record<"instagram" | "facebook" | "tiktok" | "linkedin" | "x" | "youtube", string>>;
}

const MAX_HTML = 1_500_000;
const MAX_AT_SIGNS = 2000;
const LOCAL_CHAR = /[A-Za-z0-9._%+-]/;
const DOMAIN_CHAR = /[A-Za-z0-9.-]/;
const DOMAIN_SHAPE = /^[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4}$/;

/** Candidate addresses around each "@". Work is bounded by the number of "@" signs and a fixed window on each side. */
function emailCandidates(html: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let n = 0; n < MAX_AT_SIGNS; n++) {
    const at = html.indexOf("@", from);
    if (at < 0) break;
    from = at + 1;
    let l = at;
    while (l > 0 && at - l < 64 && LOCAL_CHAR.test(html[l - 1])) l--;
    let r = at + 1;
    while (r < html.length && r - at <= 253 && DOMAIN_CHAR.test(html[r])) r++;
    const domain = html.slice(at + 1, r).replace(/^[.-]+|[.-]+$/g, "");
    if (l === at || !DOMAIN_SHAPE.test(domain)) continue;
    out.push(html.slice(l, at) + "@" + domain);
  }
  return out;
}

const BAD_EMAIL_TLD = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ico|avif)$/i;
const PLACEHOLDER_DOMAIN = /(^|\.)(example\.(com|org)|domain\.com|email\.com|yourdomain\.com|sentry\.io|wixpress\.com|sentry-next\.wixpress\.com|perusahaan\.(com|co\.id)|company\.com|mail\.com|namaanda\.com|yourcompany\.com)$/i;
const PLACEHOLDER_LOCAL = /^(email|nama|name|your-?email|youremail|user|username|test|contoh)@/;
const WA_RE = /(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^"'\s>]{0,80}&(?:amp;)?)?phone=|whatsapp:\/\/send\?(?:[^"'\s>]{0,80}&(?:amp;)?)?phone=)\+?(\d{8,15})/gi;

const WA_HANDLE_RE = /wa\.me\/([A-Za-z][A-Za-z0-9._]{2,29})(?![A-Za-z0-9._])/gi;
const WA_HANDLE_SKIP = /^(message|send|qr|c|channel|catalog|settings|share|link)$/i;

const SOCIAL: { key: keyof ExtractedContacts["social"]; re: RegExp; skip: RegExp }[] = [
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?/i, skip: /^(p|reel|reels|explore|accounts|stories|tv|share|sharer)$/i },
  { key: "facebook", re: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/([A-Za-z0-9.\-_]{3,80})\/?/i, skip: /^(sharer|share|dialog|plugins|tr|login|policies|help|pages|groups|events|watch|profile\.php)$/i },
  { key: "tiktok", re: /https?:\/\/(?:www\.)?tiktok\.com\/(@[A-Za-z0-9._]{2,30})\/?/i, skip: /^$/ },
  { key: "linkedin", re: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(company\/[A-Za-z0-9._\-%]{2,100})\/?/i, skip: /^$/ },
  { key: "x", re: /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{2,15})\/?/i, skip: /^(share|intent|home|i|search|hashtag|login)$/i },
  { key: "youtube", re: /https?:\/\/(?:www\.)?youtube\.com\/((?:@|channel\/|c\/)[A-Za-z0-9._\-]{2,80})\/?/i, skip: /^$/ },
];

export function cleanEmail(raw: string, siteHost: string | null): string | null {
  const e = raw.toLowerCase().replace(/^[.\-_%+]+/, "").replace(/[.]+$/, "");
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const domain = e.slice(at + 1);
  if (BAD_EMAIL_TLD.test(domain) || PLACEHOLDER_DOMAIN.test(domain) || !/^[a-z]{2,24}$/.test(domain.slice(domain.lastIndexOf(".") + 1))) return null;
  if (PLACEHOLDER_LOCAL.test(e)) return null;
  if (/^(noreply|no-reply|donotreply|mailer-daemon)@/.test(e)) return null;
  void siteHost;
  return e;
}

export function extractContacts(rawHtml: string, siteUrl: string): ExtractedContacts {
  const html = rawHtml.slice(0, MAX_HTML).replace(/&#0*64;|&commat;|\s?\[at\]\s?|\s\(at\)\s/gi, "@").replace(/&amp;/g, "&");
  let siteHost: string | null = null;
  try { siteHost = new URL(siteUrl).hostname.replace(/^www\./, ""); } catch { /* keep null */ }

  const emails = new Map<string, number>();
  for (const cand of emailCandidates(html)) {
    const e = cleanEmail(cand, siteHost);
    if (!e) continue;
    const onSite = siteHost && e.endsWith("@" + siteHost) ? 1 : 0;
    emails.set(e, Math.max(emails.get(e) ?? 0, onSite));
    if (emails.size >= 20) break;
  }
  // Own-domain addresses first: they are the business's, not a web agency's or a template's.
  const emailList = [...emails.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 5);

  const wa = new Set<string>();
  for (const m of html.matchAll(WA_RE)) {
    const n = normalizePhone("+" + m[1]);
    if (n) wa.add(n);
    if (wa.size >= 5) break;
  }

  const handles = new Set<string>();
  for (const m of html.matchAll(WA_HANDLE_RE)) {
    if (!WA_HANDLE_SKIP.test(m[1])) handles.add(m[1].toLowerCase());
    if (handles.size >= 3) break;
  }

  const social: ExtractedContacts["social"] = {};
  for (const s of SOCIAL) {
    const re = new RegExp(s.re.source, "gi");
    for (const m of html.matchAll(re)) {
      if (s.skip.test(m[1])) continue;
      social[s.key] = m[0].replace(/\/$/, "");
      break;
    }
  }
  return { emails: emailList, whatsapp: [...wa], whatsappHandles: [...handles], social };
}

export function mergeContacts(list: ExtractedContacts[]): ExtractedContacts {
  const out: ExtractedContacts = { emails: [], whatsapp: [], whatsappHandles: [], social: {} };
  for (const c of list) {
    for (const h of c.whatsappHandles) if (!out.whatsappHandles.includes(h) && out.whatsappHandles.length < 3) out.whatsappHandles.push(h);
    for (const e of c.emails) if (!out.emails.includes(e) && out.emails.length < 5) out.emails.push(e);
    for (const w of c.whatsapp) if (!out.whatsapp.includes(w) && out.whatsapp.length < 5) out.whatsapp.push(w);
    for (const [k, v] of Object.entries(c.social)) { const key = k as keyof ExtractedContacts["social"]; if (!out.social[key]) out.social[key] = v; }
  }
  return out;
}

/** Links on a page that probably lead to a contact or about page of the same site. */
export function contactPageLinks(html: string, pageUrl: string, max = 2): string[] {
  let base: URL;
  try { base = new URL(pageUrl); } catch { return []; }
  const out: string[] = [];
  for (const m of html.slice(0, MAX_HTML).matchAll(/href\s*=\s*["']([^"'#\s]{1,300})["']/gi)) {
    if (!/(kontak|contact|hubungi|tentang|about)/i.test(m[1])) continue;
    try {
      const u = new URL(m[1], base);
      if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      if (/\.(png|jpe?g|gif|webp|svg|css|js|pdf|zip)$/i.test(u.pathname)) continue;
      u.hash = "";
      const s = u.toString();
      if (s !== pageUrl && !out.includes(s)) out.push(s);
    } catch { /* ignore */ }
    if (out.length >= max) break;
  }
  return out;
}

/** The business profile page at wa.me/<username> prints the account's real number. Returns it, or null. */
export function phoneFromWaProfile(html: string): string | null {
  const m = /[?&;]phone=\+?(\d{8,15})(?!\d)/.exec(html.slice(0, MAX_HTML)) ?? /(?:^|[^\d])\+(\d{2,3}[\d ()-]{7,16}\d)(?!\d)/.exec(html.slice(0, MAX_HTML));
  return m ? normalizePhone("+" + m[1].replace(/\D/g, "")) : null;
}
