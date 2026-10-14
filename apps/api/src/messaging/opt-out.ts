const PATTERNS = [
  /^\s*stop\b/i,
  /^\s*unsubscribe\b/i,
  /^\s*berhenti\b/i,
  /\bjangan\s+(di)?(hubungi|kirim|chat|wa|whatsapp)\b/i,
  /\bhapus\s+(nomor|data|kontak)\b/i,
  /\btidak\s+(usah|perlu)\s+(di)?(hubungi|chat|kirim)\b/i,
  /\b(tolong\s+)?(berhenti|stop)\s+(kirim|chat|hubungi)/i,
];

/** A short message that contains the word itself: people answer our own "balas STOP" line inside a sentence ("Maaf kak belum ya STOP", "ok stop"). */
const SHORT_PATTERNS = [/(?<!\bbus\s)\bstop\b/i, /\bberhenti\b/i, /\bunsubscribe\b/i, /\bjangan\s+ganggu\b/i];
const SHORT_MAX = 80;

/** True when an incoming message asks not to be contacted again. Deliberately conservative: a false positive only stops one conversation. */
export function isOptOut(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 300) return false;
  return PATTERNS.some((p) => p.test(t)) || (t.length <= SHORT_MAX && SHORT_PATTERNS.some((p) => p.test(t)));
}

/** Line added to first-contact drafts so the recipient always has a way out. */
export const OPT_OUT_HINT_ID = "Kalau tidak berkenan, balas STOP.";
export const OPT_OUT_HINT_EN = "If you'd rather not hear from me, reply STOP.";

const INJECTION = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)/i,
  /abaikan\s+(semua\s+|seluruh\s+)?(instruksi|perintah|aturan)/i,
  /(system|developer)\s+prompt/i,
  /\byou\s+are\s+now\b/i,
  /\b(kamu|anda)\s+(sekarang\s+)?(adalah|menjadi)\b.*\b(asisten|ai|bot)\b/i,
  /\bact\s+as\b/i,
  /<\/?(system|pesan_pelanggan|instructions?)>/i,
];

/** True when an incoming message looks like it tries to give instructions to the AI. The draft is still written, but flagged for the reviewer. */
export function looksLikeInjection(text: string): boolean {
  return INJECTION.some((p) => p.test(text));
}
