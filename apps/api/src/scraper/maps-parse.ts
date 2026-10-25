/** Pure helpers for reading Google Maps result cards, kept apart from the browser code so they can be tested. */

/** Maps shows "4,6" in Indonesian and "4.6" in English; scoring needs a plain number. */
export function normalizeRating(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.trim().replace(",", ".").match(/^\d(?:\.\d)?/);
  return m ? m[0] : "";
}

const NOT_CATEGORY = /^(\d[.,]\d|\(?\d[\d.,]*\)?$|buka|tutup|open|closed|opens|closes|sementara tutup|permanently|buka 24|24 jam|sponsor|iklan)/i;
const ADDRESS_LIKE = /^(jl\.?|jalan|gg\.?|gang|street|st\.|rd\.|road|ruko|komplek|no\.?\s*\d)/i;

/**
 * The category on a result card is the first segment of the line "Category · Address".
 * `rows` are the text of the card's info rows. Returns "" when nothing looks like a category.
 */
export function pickCategory(rows: string[]): string {
  for (const row of rows) {
    const t = row.trim();
    if (!t || NOT_CATEGORY.test(t)) continue;
    const first = t.split("·")[0].trim();
    if (!first || first.length > 60 || NOT_CATEGORY.test(first) || ADDRESS_LIKE.test(first) || /\d{3,}/.test(first)) continue;
    return first;
  }
  return "";
}

/** The listing's own opening status, read from the text of a result card. Null when the card says nothing about it. */
export function businessStatusFrom(rows: string[]): "permanently_closed" | "temporarily_closed" | null {
  const text = rows.join(" ").slice(0, 4000).toLowerCase();
  if (/permanently closed|tutup permanen/.test(text)) return "permanently_closed";
  if (/temporarily closed|sementara tutup|tutup sementara/.test(text)) return "temporarily_closed";
  return null;
}

const SERVICE_CHIP = /^(dine-?in|takeaway|take-?out|delivery|drive-?through|curbside pickup|kerbside pickup|no-contact delivery|in-store pickup|makan di tempat|bawa pulang|pesan antar|ambil di tempat)$/i;
const HOURS = /^(open|closed|opens|closes|closing|buka|tutup)\b|\b(am|pm)$|24 (hours|jam)/i;
const PHONE_LIKE = /^\+?[\d\s().-]{7,24}$/;

/** A phone number as written on a card: only digits, spaces and the usual punctuation, with 7 to 15 digits. */
export function looksLikePhone(text: string): boolean {
  const t = text.trim();
  const digits = t.replace(/\D/g, "").length;
  return PHONE_LIKE.test(t) && digits >= 7 && digits <= 15;
}

/**
 * The card's info row reads "Category · Address". The address is what follows the category, in any language and country:
 * hours, service options ("Dine-in", "Takeaway") and a phone number are not part of it. Returns "" when the card has none.
 */
export function pickAddress(rows: string[], category: string): string {
  let best: string[] | null = null;
  for (const row of rows) {
    const parts = row.split("·").map((p) => p.trim());
    if (parts.length < 2 || (category && parts[0] !== category)) continue;
    // The same text is nested in several rows, the longer ones with the opening hours glued on: take the shortest.
    if (!best || row.length < best.join("·").length) best = parts;
  }
  if (!best) return "";
  const keep = best.slice(1).filter((p) => p.length >= 3 && !SERVICE_CHIP.test(p) && !HOURS.test(p) && !looksLikePhone(p));
  return keep.join(", ").slice(0, 300);
}

/** The first phone number in the card's info rows, as written. */
export function pickPhone(rows: string[]): string {
  for (const row of rows) for (const part of row.split("·")) if (looksLikePhone(part)) return part.trim();
  return "";
}
