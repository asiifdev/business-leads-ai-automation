const PATTERNS = [
  /^\s*stop\b/i,
  /^\s*unsubscribe\b/i,
  /^\s*berhenti\b/i,
  /\bjangan\s+(di)?(hubungi|kirim|chat|wa|whatsapp)\b/i,
  /\bhapus\s+(nomor|data|kontak)\b/i,
  /\btidak\s+(usah|perlu)\s+(di)?(hubungi|chat|kirim)\b/i,
  /\b(tolong\s+)?(berhenti|stop)\s+(kirim|chat|hubungi)/i,
];

/** True when an incoming message asks not to be contacted again. Deliberately conservative: a false positive only stops one conversation. */
export function isOptOut(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 300) return false;
  return PATTERNS.some((p) => p.test(t));
}

/** Line added to first-contact drafts so the recipient always has a way out. */
export const OPT_OUT_HINT_ID = "Kalau tidak berkenan, balas STOP.";
export const OPT_OUT_HINT_EN = "If you'd rather not hear from me, reply STOP.";
