/**
 * Two results are the same business when they share a phone number AND a place, or else a name and an address.
 * A number shared by listings at different addresses is a chain's central line: each outlet stays its own lead
 * (the leads step marks it as a branch), so a business with outlets in several cities is not reduced to one.
 */
export function leadKey(b: { name: string; address: string; phone: string }): string {
  const digits = (b.phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return `${b.name.toLowerCase()}|${b.address.toLowerCase()}`;
  const place = (b.address ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 80) || b.name.toLowerCase();
  return `tel:${digits.replace(/^0/, "62")}|${place}`;
}
