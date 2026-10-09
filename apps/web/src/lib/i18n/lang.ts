/** Server-safe pieces of i18n (no "use client"): the root layout imports these. */
export type Lang = "en" | "id";
export const LANG_COOKIE = "prospex_lang";

export function parseLang(value: string | undefined | null): Lang {
  return value === "id" ? "id" : "en";
}
