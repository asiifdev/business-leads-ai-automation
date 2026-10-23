/** Two results are the same business when they share a phone number, or else a name and an address. */
export function leadKey(b: { name: string; address: string; phone: string }): string {
  const digits = (b.phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `tel:${digits.replace(/^0/, "62")}` : `${b.name.toLowerCase()}|${b.address.toLowerCase()}`;
}
