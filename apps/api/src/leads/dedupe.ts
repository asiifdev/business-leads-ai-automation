/**
 * Finds the same business twice: in another campaign, from another query, or later from another source.
 * Pure and bounded, so it can be tested with hostile input. Matching order: phone, website domain, then name plus place.
 */
import { normalizePhone } from "../messaging/phone";

export interface DedupeCandidate {
  id?: string;
  name: string;
  phone?: string | null;
  phoneE164?: string | null;
  website?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Hosts that many unrelated businesses share (profile pages, link pages, builders, marketplaces): never a sign of the same business. */
const SHARED_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "fb.me", "tiktok.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "youtu.be",
  "wa.me", "whatsapp.com", "linktr.ee", "linktree.com", "bio.link", "beacons.ai", "carrd.co", "business.site", "google.com", "goo.gl",
  "wixsite.com", "blogspot.com", "wordpress.com", "weebly.com", "tokopedia.com", "shopee.co.id", "lazada.co.id", "bukalapak.com",
];

function isSharedHost(host: string): boolean {
  return SHARED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** "https://www.Example.com/x" -> "example.com"; null for invalid, shared or too long input. */
export function websiteDomain(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!host.includes(".") || isSharedHost(host)) return null;
  return host;
}

const NAME_NOISE = /\b(pt|cv|ud|toko|the|official|store|shop|cabang|branch)\b/g;
/** Lowercase letters and digits only, without company words, so "Toko Maju Jaya" and "MAJU JAYA!" meet. */
export function nameKey(name: string): string {
  return name.slice(0, 200).toLowerCase().replace(NAME_NOISE, " ").replace(/[^a-z0-9]+/g, "");
}

/** Metres between two points (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SAME_PLACE_M = 150;

export type DuplicateReason = "phone" | "website" | "name_place";

/**
 * Lookup tables over the leads already stored, so checking a batch of new leads does not compare every pair.
 * `find` returns the first stored lead that is the same business, with why. Branches with their own number are not duplicates.
 */
export function createDuplicateIndex<T extends DedupeCandidate>(existing: T[]) {
  const byPhone = new Map<string, T>();
  const byDomain = new Map<string, T[]>();
  const byName = new Map<string, T[]>();
  const add = (e: T) => {
    const phone = e.phoneE164 || normalizePhone(e.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, e);
    const domain = websiteDomain(e.website);
    if (domain) byDomain.set(domain, [...(byDomain.get(domain) ?? []), e]);
    const key = nameKey(e.name);
    if (key.length >= 4) byName.set(key, [...(byName.get(key) ?? []), e]);
  };
  for (const e of existing) add(e);
  return {
    /** Adds a lead that is now known, so later ones are compared with it too. */
    add,
    find(lead: DedupeCandidate): { match: T; reason: DuplicateReason } | null {
      const phone = lead.phoneE164 || normalizePhone(lead.phone);
      const byNumber = phone ? byPhone.get(phone) : undefined;
      if (byNumber) return { match: byNumber, reason: "phone" };
      const domain = websiteDomain(lead.website);
      // A chain's branches share one website but each has its own number: two different numbers mean two outlets, not one business.
      const bySite = domain ? (byDomain.get(domain) ?? []).find((e) => {
        const ePhone = e.phoneE164 || normalizePhone(e.phone);
        return !(phone && ePhone && phone !== ePhone);
      }) : undefined;
      if (bySite) return { match: bySite, reason: "website" };
      const key = nameKey(lead.name);
      if (key.length < 4 || typeof lead.lat !== "number" || typeof lead.lng !== "number") return null;
      for (const e of byName.get(key) ?? []) {
        const ePhone = e.phoneE164 || normalizePhone(e.phone);
        if (phone && ePhone && phone !== ePhone) continue; // two numbers under one name: separate branches
        if (typeof e.lat === "number" && typeof e.lng === "number" && distanceM({ lat: lead.lat, lng: lead.lng }, { lat: e.lat, lng: e.lng }) <= SAME_PLACE_M) return { match: e, reason: "name_place" };
      }
      return null;
    },
  };
}

/** One-off form of `createDuplicateIndex(existing).find(lead)`. */
export function findDuplicate<T extends DedupeCandidate>(lead: DedupeCandidate, existing: T[]) {
  return createDuplicateIndex(existing).find(lead);
}
