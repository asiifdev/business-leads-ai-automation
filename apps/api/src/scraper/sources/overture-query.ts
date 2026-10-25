/** The DuckDB query for Overture Maps places and the reading of its rows. Pure, so it is tested without the network or DuckDB. */
import { isValidEmail } from "../../messaging/email-address";
import { normalizePhone } from "../../messaging/phone";
import type { RawSourceLead } from "./lead-source";
import type { Bbox } from "./osm-overpass";
import { profileUrl } from "./osm-overpass";

/** Where the places are: an S3 or HTTPS address of parquet files, or a local path. Anything else is refused. */
export function assertSafeDataset(url: string): string {
  if (!/^(s3:\/\/|https:\/\/|\/)[A-Za-z0-9_.\-/:=*]{3,300}$/.test(url) || url.includes("..")) throw new Error("OVERTURE_PLACES_URL is not a valid dataset address");
  return url;
}

/** `%` and `_` typed in a name phrase mean themselves, not "anything". */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface PlacesQueryInput {
  dataset: string;
  box: Bbox;
  stems: string[];
  names: string[];
  minConfidence: number;
  limit: number;
}

/**
 * Places inside the box that have some way to reach them, are in one of the categories or have the phrase in their name, and are
 * trusted enough, best first. Every value from outside goes through a bound parameter; only the dataset address (checked above) is
 * written into the text. The position is read as the whole `bbox` struct (`box`): DuckDB 2.0 fails with an internal error when a query
 * filters on `bbox.xmin` and also selects `bbox.xmin` as a column.
 */
export function buildPlacesQuery(q: PlacesQueryInput): { sql: string; values: (string | number)[] } {
  const values: (string | number)[] = [q.box.west, q.box.east, q.box.south, q.box.north, q.minConfidence];
  const wanted: string[] = [];
  for (const s of q.stems) { wanted.push("(taxonomy.primary LIKE ? OR basic_category LIKE ?)"); values.push(`%${s}%`, `%${s}%`); }
  for (const n of q.names) { wanted.push("names.primary ILIKE ? ESCAPE '\\'"); values.push(`%${likeEscape(n)}%`); }
  if (!wanted.length) throw new Error("No usable search term for Overture Maps");
  const cap = Math.min(Math.max(Math.floor(q.limit), 1), 5000);
  values.push(cap);
  const sql = `SELECT * FROM (
  SELECT id, names.primary AS name, taxonomy.primary AS category, operating_status AS status, phones, websites, emails, socials,
         addresses[1].freeform AS address, addresses[1].locality AS city, addresses[1].region AS region, confidence,
         bbox AS box
  FROM read_parquet('${assertSafeDataset(q.dataset)}', hive_partitioning=1)
  WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
    AND confidence >= ?
    AND (len(phones) > 0 OR len(websites) > 0 OR len(emails) > 0 OR len(socials) > 0)
    AND (${wanted.join(" OR ")})
) ORDER BY confidence DESC LIMIT ?`;
  return { sql, values };
}

export type OvertureRow = Record<string, unknown>;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => { const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };

/** One Overture place as a lead, or null when it has no name or nothing to reach it by. */
export function overtureRowToLead(row: OvertureRow, industry = ""): RawSourceLead | null {
  const name = str(row.name, 200);
  if (!name) return null;
  // A mobile number first: those are on WhatsApp. Anything that is not a number is dropped.
  const phones = strings(row.phones).filter((p) => normalizePhone(p));
  const phone = phones.find((p) => normalizePhone(p)?.startsWith("628")) ?? phones[0] ?? "";
  const website = strings(row.websites).map((w) => w.trim()).find((w) => {
    try { const u = new URL(w); return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") && w.length <= 300; } catch { return false; }
  }) ?? "";
  const email = strings(row.emails).map((e) => e.trim().toLowerCase()).find((e) => isValidEmail(e)) ?? "";
  const socials = strings(row.socials);
  const social: NonNullable<RawSourceLead["social"]> = {};
  const ig = socials.map((s) => profileUrl("instagram", s)).find(Boolean);
  const fb = socials.map((s) => profileUrl("facebook", s)).find(Boolean);
  if (ig) social.instagram = ig;
  if (fb) social.facebook = fb;
  if (!phone && !website && !email && !ig && !fb) return null;
  const box = row.box && typeof row.box === "object" ? (row.box as Record<string, unknown>) : {};
  const lat = num(box.ymin ?? row.lat);
  const lng = num(box.xmin ?? row.lng);
  const status = str(row.status, 30).toLowerCase();
  const address = str(row.address, 300) || [str(row.city, 80), str(row.region, 80)].filter(Boolean).join(", ");
  return {
    name, address, phone, website, ...(email ? { email } : {}),
    rating: "N/A", reviewCount: null, category: str(row.category, 100).replace(/_/g, " "), hasWebsite: !!website,
    referenceUrl: "", lat, lng,
    businessStatus: status === "closed" || status === "permanently_closed" ? "permanently_closed" : status === "temporarily_closed" ? "temporarily_closed" : null,
    ...(Object.keys(social).length ? { social } : {}),
    industry, source: "overture",
  };
}

/** Rows to leads, each place once. */
export function leadsFromRows(rows: OvertureRow[], industry = "", max = Infinity): RawSourceLead[] {
  const seen = new Set<string>();
  const out: RawSourceLead[] = [];
  for (const r of rows) {
    if (out.length >= max) break;
    const id = str(r.id, 80);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const lead = overtureRowToLead(r, industry);
    if (lead) out.push(lead);
  }
  return out;
}
