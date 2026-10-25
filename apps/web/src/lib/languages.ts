/** Languages a campaign can write in: the two long-standing values first, then every two-letter language the browser knows. */
export interface LanguageOption {
  value: string;
  name: string;
}

export function languageOptions(lang: string): LanguageOption[] {
  const names = new Intl.DisplayNames([lang], { type: "language", fallback: "none" });
  const fixed = new Set(["id", "en"]);
  const rest: LanguageOption[] = [];
  for (let a = 97; a <= 122; a++) {
    for (let b = 97; b <= 122; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      if (name && !fixed.has(code)) rest.push({ value: code, name });
    }
  }
  rest.sort((x, y) => x.name.localeCompare(y.name, lang));
  return [
    { value: "indonesian", name: names.of("id") ?? "Indonesian" },
    { value: "english", name: names.of("en") ?? "English" },
    ...rest,
  ];
}

export function languageLabel(value: string | undefined, lang: string): string {
  const v = value === "indonesian" ? "id" : value === "english" ? "en" : value;
  if (!v) return "—";
  return new Intl.DisplayNames([lang], { type: "language", fallback: "code" }).of(v) ?? v;
}

/** The language people in a country most likely use ("ID" is Indonesian, "EG" Arabic); the same rule as the API's. */
export function defaultLanguageFor(country: string): string {
  if (country === "ID" || !/^[A-Z]{2}$/.test(country)) return "indonesian";
  try {
    const l = new Intl.Locale(`und-${country}`).maximize().language;
    return l === "en" ? "english" : l;
  } catch {
    return "english";
  }
}
