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
