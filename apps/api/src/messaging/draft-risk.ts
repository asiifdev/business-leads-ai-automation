/**
 * Second line of defence after the prompt: look at what the model actually wrote.
 * A draft that introduces links, contact details, prices, discounts or bank details that the knowledge base does not contain
 * is not blocked (a person still reviews it) but it is flagged so the reviewer looks twice.
 */
const RISKY: [RegExp, string][] = [
  [/https?:\/\/|www\./i, "link"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "email"],
  [/\b\d{1,3}\s?%/, "percentage"],
  [/\b(diskon|discount|gratis|free of charge|refund|cashback|promo)\b/i, "discount"],
  [/\b(rekening|no\.?\s?rek|transfer\s+ke|bank\s+(bca|bri|mandiri|bni)|virtual account)\b/i, "bank details"],
  [/\b(rp\.?|idr|usd|\$)\s?\d/i, "price"],
  // reading meaning into a rating or review count is a claim about the recipient that the data does not support
  [/\b(menunjukkan|membuktikan|mencerminkan|menandakan|berarti|tentu(nya)?|pasti)\b[^.!?\n]{0,60}\b(kepercayaan|puas|bagus|baik|ramai|laris|diminati|populer|tinggi|berkualitas|profesional)/i, "assumption"],
  [/\b(Bapak|Ibu|Pak|Bu)\b(?!\s+[A-Z])/, "honorific"],
];

export function draftRisks(draft: string, knowledge: string[]): string[] {
  const known = knowledge.join("\n").toLowerCase();
  const found: string[] = [];
  for (const [re, label] of RISKY) {
    const m = draft.match(re);
    if (m && !known.includes(m[0].toLowerCase())) found.push(label);
  }
  return [...new Set(found)];
}
