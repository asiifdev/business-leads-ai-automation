/** Building the Overpass query and reading its answer. Pure, so it is tested without a network. */
import { isValidEmail } from "../../messaging/email-address";
import { normalizePhone } from "../../messaging/phone";
import type { RawSourceLead } from "./lead-source";
import type { OsmFilter } from "./osm-tags";

export interface Bbox { south: number; west: number; north: number; east: number }

/** A tag key or value is only ever letters, digits and underscores, so it can be written into the query as it is. */
const TOKEN = /^[a-z0-9_:]{1,60}$/;
const BUSINESS_KEYS = "^(shop|amenity|craft|office|tourism|leisure|healthcare)$";
/** A place with none of these cannot be contacted or read for more details (a profile page can be read), so it is not worth a lead. */
const CONTACT_KEYS = "^(phone|contact:phone|mobile|contact:mobile|contact:whatsapp|website|contact:website|url|email|contact:email|instagram|contact:instagram|facebook|contact:facebook)$";

/**
 * The Overpass QL for every filter inside the box. Every element must have a name and, unless `contactOnly` is false, some way of
 * reaching it (phone, website or e-mail); element kinds are nodes, ways and relations.
 */
export function buildOverpassQuery(filters: OsmFilter[], box: Bbox, limit: number, timeoutS = 60, contactOnly = true): string {
  const b = `(${box.south},${box.west},${box.north},${box.east})`;
  const reach = contactOnly ? `[~"${CONTACT_KEYS}"~"."]` : "";
  const lines: string[] = [];
  for (const f of filters.slice(0, 40)) {
    if (f.tag && TOKEN.test(f.tag[0]) && TOKEN.test(f.tag[1])) {
      lines.push(`  nwr["${f.tag[0]}"="${f.tag[1]}"]["name"]${reach}${b};`);
    } else if (f.name && /^[A-Za-z0-9 '&-]{3,60}$/.test(f.name)) {
      // A name alone would match anything; it also has to be a shop, office, amenity and so on.
      lines.push(`  nwr["name"~"${f.name.replace(/[-&']/g, ".")}",i][~"${BUSINESS_KEYS}"~"."]${reach}${b};`);
    }
  }
  if (!lines.length) throw new Error("No usable search term for OpenStreetMap");
  const cap = Math.min(Math.max(Math.floor(limit), 1), 1000);
  return `[out:json][timeout:${timeoutS}];\n(\n${lines.join("\n")}\n);\nout center tags ${cap};`;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const first = (v: string | undefined) => (v ? v.split(";")[0].trim() : "");
const humanize = (s: string) => s.replace(/_/g, " ");

function address(t: Record<string, string>): string {
  if (t["addr:full"]) return t["addr:full"].slice(0, 300);
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  return [street, t["addr:suburb"] || t["addr:village"], t["addr:city"] || t["addr:town"], t["addr:postcode"]].filter(Boolean).join(", ").slice(0, 300);
}

function website(t: Record<string, string>): string {
  const v = first(t.website || t["contact:website"] || t.url);
  if (!v || v.length > 300) return "";
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    return u.hostname.includes(".") ? u.toString() : "";
  } catch {
    return "";
  }
}

/** An Instagram or Facebook page from a tag that holds either a full address or just the account name. Anything else is dropped. */
export function profileUrl(platform: "instagram" | "facebook", raw: string | undefined): string | null {
  const v = first(raw).replace(/^@/, "");
  if (!v || v.length > 200) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const host = u.hostname.toLowerCase().replace(/^www\./, "");
      return (platform === "instagram" ? host === "instagram.com" : host === "facebook.com" || host === "fb.com") && u.pathname.length > 1 ? u.toString() : null;
    } catch {
      return null;
    }
  }
  if (platform === "instagram") return /^[A-Za-z0-9._]{1,30}$/.test(v) ? `https://www.instagram.com/${v}/` : null;
  return /^[A-Za-z0-9.\-]{3,60}$/.test(v) ? `https://www.facebook.com/${v}` : null;
}

/** One OpenStreetMap element as a lead, or null when it is not a usable business (no name, closed down, no position). */
export function elementToLead(el: OsmElement, industry = ""): RawSourceLead | null {
  const t = el.tags ?? {};
  const name = (t.name ?? "").trim().slice(0, 200);
  if (!name) return null;
  // Lifecycle prefixes mark a place that is gone: disused:shop=camera, abandoned:amenity=cafe.
  if (Object.keys(t).some((k) => /^(disused|abandoned|was|closed|razed|demolished):/.test(k)) || t.disused === "yes" || t.abandoned === "yes") return null;
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;
  const phoneRaw = first(t.phone || t["contact:phone"] || t["contact:mobile"] || t.mobile || t["contact:whatsapp"]);
  const phone = normalizePhone(phoneRaw) ? phoneRaw : "";
  const emailRaw = first(t.email || t["contact:email"]).toLowerCase();
  const site = website(t);
  const key = ["shop", "amenity", "craft", "office", "tourism", "leisure", "healthcare"].find((k) => t[k]);
  // The query asks for places with contact tags, but a tag can hold something unusable ("-", a social link): then there is nothing to reach.
  const social: NonNullable<RawSourceLead["social"]> = {};
  const ig = profileUrl("instagram", t["contact:instagram"] || t.instagram);
  const fb = profileUrl("facebook", t["contact:facebook"] || t.facebook);
  if (ig) social.instagram = ig;
  if (fb) social.facebook = fb;
  if (!phone && !site && !isValidEmail(emailRaw) && !ig && !fb) return null;
  return {
    name,
    address: address(t),
    phone,
    website: site,
    ...(isValidEmail(emailRaw) ? { email: emailRaw } : {}),
    rating: "N/A",
    reviewCount: null,
    category: key ? humanize(t[key]) : "",
    hasWebsite: !!site,
    referenceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
    businessStatus: null,
    ...(Object.keys(social).length ? { social } : {}),
    industry,
    source: "osm",
  };
}

/** Reads an Overpass JSON answer. Anything that is not the expected shape gives no leads rather than an error in the middle of a run. */
export function leadsFromOverpass(body: unknown, industry = "", max = Infinity): RawSourceLead[] {
  const elements = (body as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];
  const seen = new Set<string>();
  const out: RawSourceLead[] = [];
  for (const el of elements) {
    if (out.length >= max) break;
    if (!el || typeof el !== "object") continue;
    const e = el as OsmElement;
    if (!["node", "way", "relation"].includes(e.type) || typeof e.id !== "number") continue;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const lead = elementToLead(e, industry);
    if (lead) out.push(lead);
  }
  return out;
}

/** Nominatim's answer for a place name as a box, or null. Its boundingbox is [south, north, west, east] as strings. */
export function bboxFromNominatim(body: unknown): Bbox | null {
  const hit = Array.isArray(body) ? (body[0] as { boundingbox?: unknown } | undefined) : undefined;
  const bb = hit?.boundingbox;
  if (!Array.isArray(bb) || bb.length !== 4) return null;
  const [south, north, west, east] = bb.map(Number);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) return null;
  return { south, west, north, east };
}
