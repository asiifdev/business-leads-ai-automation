/**
 * Normalizes a phone number to digits only with country code (WhatsApp JID user part), e.g. "0812-3456-789" -> "628123456789".
 * Returns null when the result cannot be a valid international number.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "62"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D+/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountryCode + digits.slice(1);
  } else if (defaultCountryCode === "62" && digits.startsWith("8")) {
    digits = defaultCountryCode + digits;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Extracts the number from a WhatsApp JID such as "628123456789:12@s.whatsapp.net". */
export function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  const user = jid.split("@")[0].split(":")[0];
  return /^\d{8,15}$/.test(user) ? user : null;
}

/**
 * The sender's phone number of an incoming message. WhatsApp increasingly addresses chats with an opaque "@lid"
 * instead of the phone number; in that case the real number travels in `senderPn` (or `participantPn`).
 */
export function phoneFromKey(key: { remoteJid?: string | null; senderPn?: string | null; participantPn?: string | null }): string | null {
  return phoneFromJid(key.remoteJid) ?? phoneFromJid(key.senderPn) ?? phoneFromJid(key.participantPn);
}
