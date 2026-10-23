/**
 * Turns the rows of an imported file into leads. The columns are found by their headings (English or Indonesian) and can be
 * corrected by the person importing. Nothing is guessed about a row: a value that does not look like what the column should hold
 * (a phone that is not a number, an e-mail without a domain) is dropped and counted, never stored.
 */
import { isValidEmail } from "../../messaging/email-address";
import { normalizePhone } from "../../messaging/phone";
import { mergeSourceLeads } from "../../scraper/sources/merge";
import type { RawSourceLead } from "../../scraper/sources/lead-source";
import { ImportError, MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "./csv";

export const IMPORT_FIELDS = ["name", "phone", "email", "website", "address", "category", "city", "lat", "lng"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
/** Column number (zero-based) for each field, or null when the file has no such column. */
export type ColumnMapping = Record<ImportField, number | null>;

const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "nama", "nama bisnis", "nama usaha", "nama perusahaan", "business", "business name", "company", "company name", "perusahaan", "usaha", "toko", "title"],
  phone: ["phone", "telepon", "telp", "tlp", "no telepon", "nomor telepon", "no telp", "no hp", "nomor hp", "hp", "handphone", "mobile", "whatsapp", "wa", "no wa", "nomor wa", "kontak", "phone number", "telephone", "tel"],
  email: ["email", "e-mail", "e mail", "surel", "alamat email", "email address", "mail"],
  website: ["website", "web", "situs", "url", "link", "laman", "site", "homepage", "website url"],
  address: ["address", "alamat", "alamat lengkap", "lokasi", "street", "jalan", "street address", "full address"],
  category: ["category", "kategori", "jenis", "jenis usaha", "bidang", "industri", "industry", "type", "tipe", "bidang usaha", "sektor"],
  city: ["city", "kota", "kabupaten", "kota/kabupaten", "regency", "area", "wilayah", "daerah"],
  lat: ["lat", "latitude", "lintang"],
  lng: ["lng", "lon", "long", "longitude", "bujur"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-./]+/g, " ").replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

/** Finds each field's column from the first row. A heading is used for one field only, the best-fitting one. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null])) as ColumnMapping;
  const taken = new Set<number>();
  const cols = headers.slice(0, MAX_IMPORT_COLUMNS).map(norm);
  // An exact heading beats a partial one, and fields are taken in order of how unmistakable they are.
  for (const pass of ["exact", "contains"] as const) {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field] !== null) continue;
      const aliases = ALIASES[field].map(norm);
      const hit = cols.findIndex((c, i) => !taken.has(i) && c !== "" && (pass === "exact" ? aliases.includes(c) : aliases.some((a) => a.length >= 4 && c.includes(a))));
      if (hit >= 0) { mapping[field] = hit; taken.add(hit); }
    }
  }
  return mapping;
}

/** A mapping sent by the browser: whole-number columns inside the file, each used once. Anything else is refused. */
export function parseMapping(input: unknown, columnCount: number): ColumnMapping {
  const out = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null])) as ColumnMapping;
  if (!input || typeof input !== "object") return out;
  const used = new Set<number>();
  for (const f of IMPORT_FIELDS) {
    const v = (input as Record<string, unknown>)[f];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= columnCount) throw new ImportError(`The column chosen for "${f}" is not in the file.`);
    if (used.has(v)) throw new ImportError("The same column is chosen for two different fields.");
    used.add(v);
    out[f] = v;
  }
  return out;
}

export interface ImportReport {
  rows: number;
  leads: number;
  /** Rows with no business name. */
  noName: number;
  /** Rows found twice in the file (same phone, website or name at the same place) and merged. */
  merged: number;
  /** Values that were left out because they did not look right. */
  badPhone: number;
  badEmail: number;
  badWebsite: number;
  /** Leads that have no phone, e-mail or website at all: they are kept but cannot be contacted. */
  noContact: number;
}

function website(raw: string): string | null {
  const v = raw.trim().split(/\s+/)[0] ?? "";
  if (!v || v.length > 300) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

const coord = (raw: string, limit: number) => {
  const n = Number(raw.trim().replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

/** `rows` includes the heading row. */
export function rowsToLeads(rows: string[][], mapping: ColumnMapping, industry: string): { leads: RawSourceLead[]; report: ImportReport } {
  if (mapping.name === null) throw new ImportError("There is no column for the business name. Choose which column holds it.");
  const body = rows.slice(1);
  if (body.length > MAX_IMPORT_ROWS) throw new ImportError(`The file has more than ${MAX_IMPORT_ROWS} rows. Split it and import the parts one by one.`);
  const report: ImportReport = { rows: body.length, leads: 0, noName: 0, merged: 0, badPhone: 0, badEmail: 0, badWebsite: 0, noContact: 0 };
  const cell = (row: string[], f: ImportField) => (mapping[f] === null ? "" : (row[mapping[f] as number] ?? "").trim());
  const parsed: RawSourceLead[] = [];
  for (const row of body) {
    const name = cell(row, "name").slice(0, 200);
    if (!name) { report.noName++; continue; }
    let phone = cell(row, "phone");
    if (phone && !normalizePhone(phone.split(/[;,/]/)[0].trim())) { report.badPhone++; phone = ""; }
    else if (phone) phone = phone.split(/[;,/]/)[0].trim();
    let email = cell(row, "email").split(/[;, ]/)[0].toLowerCase();
    if (email && !isValidEmail(email)) { report.badEmail++; email = ""; }
    let site = "";
    const rawSite = cell(row, "website");
    if (rawSite) { const w = website(rawSite); if (w) site = w; else report.badWebsite++; }
    const street = cell(row, "address");
    const city = cell(row, "city");
    const address = (street && city && !street.toLowerCase().includes(city.toLowerCase()) ? `${street}, ${city}` : street || city).slice(0, 300);
    parsed.push({
      name, address, phone, website: site, ...(email ? { email } : {}),
      rating: "N/A", reviewCount: null, category: cell(row, "category").slice(0, 100), hasWebsite: !!site, referenceUrl: "",
      lat: coord(cell(row, "lat"), 90), lng: coord(cell(row, "lng"), 180), businessStatus: null, industry, source: "csv_import",
    });
  }
  const merged = mergeSourceLeads([], parsed);
  report.merged = merged.merged;
  report.leads = merged.leads.length;
  report.noContact = merged.leads.filter((l) => !l.phone && !l.email && !l.website).length;
  return { leads: merged.leads, report };
}
