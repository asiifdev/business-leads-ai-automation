import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { normalizePhone } from "./phone";

/**
 * Phone numbers of any country, read with libphonenumber-js (offline, no service). Indonesian campaigns keep the long-standing
 * rules in `normalizePhone`; every other country is parsed by its own numbering plan, and a number that is not valid there is
 * dropped rather than stored.
 */

/** Digits with the country code ("201012345678"), or null when `raw` is not a valid number in `country` (or internationally). */
export function phoneDigitsFor(raw: string | null | undefined, country: string): string | null {
  if (!raw) return null;
  if (country === "ID") return normalizePhone(raw);
  const p = parsePhoneNumberFromString(raw.trim().slice(0, 40), country as CountryCode);
  return p?.isValid() ? p.number.slice(1) : null;
}

/** The same number written "+201012345678", or "" when it is not valid. */
export function internationalFor(raw: string | null | undefined, country: string): string {
  const d = phoneDigitsFor(raw, country);
  return d ? `+${d}` : "";
}

/**
 * Whether digits-with-country-code are a mobile number, the kind that can be on WhatsApp. Indonesian mobile numbers are
 * "628…"; elsewhere the numbering plan decides (where it cannot tell mobile from fixed line, the number is kept: WhatsApp's
 * own check settles it later).
 */
export function isMobileDigits(digits: string): boolean {
  if (digits.startsWith("628")) return true;
  const p = parsePhoneNumberFromString(`+${digits.slice(0, 20)}`);
  const type = p?.getType();
  return type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE";
}
