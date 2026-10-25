/** Every country the browser knows, named in the interface language. The API keeps only the two-letter code. */
export interface CountryOption {
  code: string;
  name: string;
}

/** Same list as the API (`apps/api/src/common/country.ts`): codes the browser names that are not countries. */
const NOT_COUNTRIES = new Set(["AC", "CP", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "XA", "XB", "ZZ"]);

export function countryOptions(lang: string): CountryOption[] {
  const names = new Intl.DisplayNames([lang], { type: "region", fallback: "none" });
  const out: CountryOption[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      if (name && !NOT_COUNTRIES.has(code)) out.push({ code, name });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, lang));
}

export function countryLabel(code: string | undefined, lang: string): string {
  if (!code) return "—";
  return new Intl.DisplayNames([lang], { type: "region", fallback: "code" }).of(code) ?? code;
}
