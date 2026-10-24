/** What to read to learn more about a lead: its own website, or failing that a public Instagram or Facebook page it has. */
import { STALE_DAYS } from "./data-quality";
import { isProfileHost, platformOf, type ProfilePlatform } from "./profile-meta";

export type EnrichTarget =
  | { kind: "website"; url: string }
  | { kind: "profile"; url: string; platform: ProfilePlatform };

const DAY_MS = 86_400_000;

function socialOf(enrichment: unknown): Partial<Record<ProfilePlatform, string>> {
  const s = enrichment && typeof enrichment === "object" ? (enrichment as { social?: unknown }).social : undefined;
  if (!s || typeof s !== "object") return {};
  const out: Partial<Record<ProfilePlatform, string>> = {};
  for (const p of ["instagram", "facebook"] as const) {
    const v = (s as Record<string, unknown>)[p];
    if (typeof v === "string" && platformOf(v) === p) out[p] = v;
  }
  return out;
}

/**
 * The lead's own website when it has one. A "website" that is really a profile page (instagram.com/x) is read as a profile. Without
 * a website, a profile found earlier (printed in the listing's own data, or on a page we read) is used, Instagram first.
 */
export function enrichTarget(lead: { website?: string | null; enrichment?: unknown }): EnrichTarget | null {
  const site = (lead.website ?? "").trim();
  if (site && !isProfileHost(site)) return { kind: "website", url: site };
  const own = site ? platformOf(site) : null;
  if (own) return { kind: "profile", url: /^https?:\/\//i.test(site) ? site : `https://${site}`, platform: own };
  const social = socialOf(lead.enrichment);
  if (social.instagram) return { kind: "profile", url: social.instagram, platform: "instagram" };
  if (social.facebook) return { kind: "profile", url: social.facebook, platform: "facebook" };
  return null;
}

/** Whether the lead has something to read that was never read, or not for STALE_DAYS. */
export function readDue(lead: { website?: string | null; enrichment?: unknown; enrichedAt?: Date | null }, now: Date = new Date()): boolean {
  if (!enrichTarget(lead)) return false;
  return !lead.enrichedAt || now.getTime() - lead.enrichedAt.getTime() > STALE_DAYS * DAY_MS;
}
