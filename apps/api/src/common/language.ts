/**
 * The language a campaign writes in. Two legacy values ("indonesian", "english") are kept as they were stored; anything else is an
 * ISO 639-1 code ("ar", "es", "fr"). Language names come from the runtime's own data, so no list lives here.
 */
export type PromptLanguage = "indonesian" | "english";

const names = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

function code(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "indonesian") return "id";
  if (v === "english") return "en";
  return v;
}

/** True for the two legacy values and for any real two-letter language code. */
export function isLanguageValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const c = code(value);
  if (!/^[a-z]{2}$/.test(c)) return false;
  try { return !!names.of(c); } catch { return false; }
}

/** The language of the prompt's own wording: Indonesian prompts for Indonesian, English wording for every other language. */
export function promptLanguage(value: string | null | undefined): PromptLanguage {
  return code(value) === "id" ? "indonesian" : "english";
}

/** The language's name as the model should read it ("Arabic"; "Bahasa Indonesia" for Indonesian). */
export function languageName(value: string | null | undefined): string {
  const c = code(value);
  if (c === "id") return "Bahasa Indonesia";
  if (c === "en" || !isLanguageValue(c)) return "English";
  return names.of(c) ?? "English";
}

/** The name to tell the model to write in when it is neither Indonesian nor English; null when the prompt's own language is the one wanted. */
export function writeInLanguage(value: string | null | undefined): string | null {
  const c = code(value);
  return c === "id" || c === "en" || !isLanguageValue(c) ? null : languageName(c);
}

/** The language people in a country most likely use, from the runtime's locale data: "ID" is Indonesian, "EG" Arabic, "US" English. */
export function defaultLanguageFor(country: string | null | undefined): string {
  const c = String(country ?? "").toUpperCase();
  if (c === "ID" || !/^[A-Z]{2}$/.test(c)) return "indonesian";
  try {
    const lang = new Intl.Locale(`und-${c}`).maximize().language;
    if (lang === "en") return "english";
    return isLanguageValue(lang) ? lang : "english";
  } catch {
    return "english";
  }
}
