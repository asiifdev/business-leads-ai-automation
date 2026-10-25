/** Countries are ISO 3166-1 alpha-2 codes ("ID", "EG", "SA"); the names come from the runtime's own region data, so no list lives here. */
export const DEFAULT_COUNTRY = "ID";

const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

/** Region codes the runtime names but that are not places to search: unions, reservations, test codes and uninhabited islands. */
export const NOT_COUNTRIES = new Set(["AC", "CP", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "XA", "XB", "ZZ"]);

/** English name of a country code, or null when the code is not a real country. */
export function countryName(code: string | null | undefined): string | null {
  const c = String(code ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || NOT_COUNTRIES.has(c)) return null;
  try {
    const n = names.of(c);
    return n ?? null;
  } catch {
    return null;
  }
}

export function isCountryCode(code: unknown): code is string {
  return typeof code === "string" && countryName(code) !== null;
}
