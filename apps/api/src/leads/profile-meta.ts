/**
 * Reads the public preview of a business's Instagram or Facebook page, the same text a chat app shows under a shared link:
 * its name and the bio. One request per profile, no posts, no followers, no login. A page that serves a login wall instead of a
 * preview gives nothing (and is reported as such), never a guess. Platforms can change or block this at any time.
 */
import { normalizePhone } from "../messaging/phone";
import { websiteDomain } from "./dedupe";
import type { PageMeta } from "./page-meta";

export type ProfilePlatform = "instagram" | "facebook";

const HOSTS: Record<ProfilePlatform, string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com", "fb.me", "m.facebook.com"],
};

/** Which supported platform a URL belongs to, or null. */
export function platformOf(url: string | null | undefined): ProfilePlatform | null {
  if (!url || url.length > 2048) return null;
  let host: string;
  try { host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  for (const [p, hosts] of Object.entries(HOSTS) as [ProfilePlatform, string[]][]) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return p;
  }
  return null;
}

/** True for a page of a social or marketplace site: those are profiles, not the business's own website. */
export function isProfileHost(url: string | null | undefined): boolean {
  return !!url && (platformOf(url) !== null || websiteDomain(url) === null);
}

export interface ProfileInfo {
  platform: ProfilePlatform;
  name: string;
  bio: string;
}

const FB_STATS = /(membicarakan ini|talking about this|pengikut|followers|likes|suka|were here|pernah ke sini|check-ins)/gi;
const FB_GENERIC = /^(facebook|log in or sign up to view|masuk atau daftar untuk melihat|log into facebook|masuk ke facebook)/i;

/** Name and bio from a profile page's preview tags, or null when the page showed no preview (login wall, missing page). */
export function profileFromMeta(platform: ProfilePlatform, meta: PageMeta): ProfileInfo | null {
  if (platform === "instagram") {
    // og:title "Name (@handle) • Instagram photos and videos"; the description tag ends with the bio in quotes.
    const title = meta.og.title ?? "";
    const m = /^(.{1,100}?)\s*\(@[A-Za-z0-9._]{1,30}\)/.exec(title);
    if (!m) return null;
    const desc = meta.tags.description ?? "";
    const q = /Instagram:\s*"(.*)"\s*$/s.exec(desc);
    return { platform, name: m[1].trim(), bio: (q?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 500) };
  }
  const title = (meta.og.title ?? meta.title ?? "").trim();
  if (!title || FB_GENERIC.test(title)) return null;
  const desc = meta.og.description ?? meta.tags.description ?? "";
  let bio = "";
  let last = -1;
  for (const m of desc.matchAll(FB_STATS)) last = m.index + m[0].length;
  if (last >= 0) {
    const dot = desc.indexOf(". ", last);
    bio = dot >= 0 ? desc.slice(dot + 2) : "";
  } else if (desc.startsWith(title)) {
    bio = desc.slice(title.length).replace(/^[.\s]+/, "");
  }
  return { platform, name: title.slice(0, 100), bio: bio.replace(/\s+/g, " ").trim().slice(0, 500) };
}

/** Indonesian mobile numbers written in running text ("WA 0812-3456-7890", "+62 812 3456 7890"). Bounded, in the first 2,000 characters. */
export function phonesFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.slice(0, 2000).matchAll(/(?:\+?62|0)[\s.-]?8\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{2,5}/g)) {
    const n = normalizePhone(m[0].startsWith("+") ? m[0] : m[0].replace(/^62/, "0").replace(/^(?!0)/, "0"));
    if (n && n.startsWith("628") && n.length >= 10 && n.length <= 14 && !out.includes(n)) out.push(n);
    if (out.length >= 3) break;
  }
  return out;
}
