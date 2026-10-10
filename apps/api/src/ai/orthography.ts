/**
 * Deterministic clean-up of drafts, applied after the model writes. Style imitation (length, word choice, emoji)
 * must never include copying sloppy capitalization or missing punctuation from chat habits, so the spelling rules
 * are enforced here instead of being left to the prompt.
 *
 * Indonesian rules follow PUEBI (the successor of EYD): capital letter at the start of a sentence and for names,
 * terminal punctuation, a comma before a vocative ("Ya, Kak"), and "Anda" capitalized.
 */

const INDONESIAN_HINTS = /\b(yang|dan|untuk|saya|kami|kak|ya|apakah|boleh|dengan|anda|ini|itu|tidak|bisa|ada|sudah|belum|dari|di|ke|pak|bu|mas|mbak)\b/gi;

/** A rough check, enough to pick the right rule set for text of unknown language. */
export function looksIndonesian(text: string): boolean {
  const hints = (text.match(INDONESIAN_HINTS) ?? []).length;
  const words = text.trim().split(/\s+/).length;
  // short replies ("ready kak") carry few hints, so one is enough there
  return hints >= 2 || (hints >= 1 && words <= 4);
}

/** Words whose trailing period is an abbreviation, not the end of a sentence. */
const ABBREVIATIONS = new Set(["dll", "dsb", "dst", "dkk", "mis", "tsb", "hlm", "no", "yg", "dg", "jl", "dr", "drg", "prof", "sdr", "ir", "tn", "ny", "cth"]);

const EN_QUESTION_STARTERS = /^(do|does|did|can|could|would|will|should|are|is|want|how|what|when|why|who|which|have|has)\b/i;
const QUESTION_STARTERS = /^(apakah|apa|bagaimana|gimana|kapan|berapa|siapa|mengapa|kenapa|dimana|di mana|bolehkah|boleh|adakah|sudahkah|maukah|bisakah|bisa)\b/i;
const VOCATIVES = ["kak", "mas", "mbak", "bu", "pak", "bapak", "ibu", "bang", "om", "tante"];
const FILLER_BEFORE_VOCATIVE = ["ya", "iya", "ok", "oke", "baik", "siap", "halo", "hai", "terima kasih", "makasih", "mohon maaf", "maaf", "permisi", "selamat pagi", "selamat siang", "selamat sore", "selamat malam"];

function upperFirst(s: string): string {
  return s.replace(/^(\P{L}*)(\p{L})/u, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

/** Capitalizes the first letter of the text, of every line, and after . ! ? (except after known abbreviations). */
function capitalizeSentences(text: string): string {
  const lines = text.split("\n").map((line) => {
    let out = upperFirst(line.trimStart());
    out = out.replace(/([.!?])(\s+)(\p{L})/gu, (m, p: string, sp: string, ch: string, offset: number) => {
      if (p === ".") {
        const before = out.slice(0, offset).match(/([\p{L}]+)$/u)?.[1]?.toLowerCase();
        if (before && ABBREVIATIONS.has(before)) return m;
      }
      return p + sp + ch.toUpperCase();
    });
    return out;
  });
  return lines.join("\n");
}

/** Adds terminal punctuation to the last sentence of a line that has none (a question mark when it opens like a question). */
function ensureTerminalPunctuation(line: string, english: boolean): string {
  const trimmed = line.trimEnd();
  if (!trimmed) return line;
  // look past trailing emoji and symbols to the last real character
  const m = trimmed.match(/^(.*?)([^\p{L}\p{N}.!?,;:)"”'’]*)$/su);
  const body = m ? m[1] : trimmed;
  const tail = m ? m[2] : "";
  if (!body || /[.!?]$/.test(body) || /[:;,]$/.test(body)) return trimmed;
  if (!/[\p{L}\p{N})"”'’]$/u.test(body)) return trimmed;
  const lastSentence = body.split(/(?<=[.!?])\s+/).pop() ?? body;
  const mark = (english ? EN_QUESTION_STARTERS : QUESTION_STARTERS).test(lastSentence.trim()) ? "?" : ".";
  return `${body}${mark}${tail}`;
}

function indonesianRules(text: string): string {
  let out = text;
  // "ya kak" -> "ya, Kak"; "terima kasih kak" -> "terima kasih, Kak"
  const filler = FILLER_BEFORE_VOCATIVE.join("|");
  const voc = VOCATIVES.join("|");
  out = out.replace(new RegExp(`\\b(${filler})\\s+(${voc})\\b`, "gi"), (_m, f: string, v: string) => `${f}, ${v[0].toUpperCase()}${v.slice(1).toLowerCase()}`);
  // a short vocative that closes a clause gets its comma: "ready kak" -> "ready, Kak"
  out = out.replace(/(\p{L})\s+(kak|mas|mbak|bang)(?=\s*(?:[.!?,]|\p{Extended_Pictographic}|$))/gimu, (_m, w: string, v: string) => `${w}, ${v[0].toUpperCase()}${v.slice(1).toLowerCase()}`);
  // a vocative that follows a comma is capitalized: ", kak" -> ", Kak"
  out = out.replace(new RegExp(`,\\s*(${voc})\\b`, "gi"), (_m, v: string) => `, ${v[0].toUpperCase()}${v.slice(1).toLowerCase()}`);
  // decimal comma for ratings: "rating 4.4" -> "rating 4,4" (thousands separators such as 2.000.000 are left alone)
  out = out.replace(/\b(rating\s+)(\d)\.(\d{1,2})(?!\d)/gi, "$1$2,$3");
  // the formal second person is capitalized
  out = out.replace(/\banda\b/gi, "Anda");
  out = out.replace(/\bAnda(nya)\b/gi, "Anda$1");
  return out;
}

export interface NormalizeOptions {
  /** "indonesian" | "english" | "auto" (default: detect). */
  language?: "indonesian" | "english" | "auto";
  /** Proper names (business, lead, owner) restored to their exact spelling wherever they appear in any casing. */
  names?: string[];
}

export function normalizeDraft(raw: string, opts: NormalizeOptions = {}): string {
  let out = raw.replace(/[ \t]+/g, " ").replace(/ +([,.!?;:])/g, "$1").replace(/[ \t]+\n/g, "\n").trim();
  const lang = opts.language && opts.language !== "auto" ? opts.language : looksIndonesian(out) ? "indonesian" : "english";
  if (lang === "indonesian") out = indonesianRules(out);
  out = out.split("\n").map((l) => ensureTerminalPunctuation(l, lang === "english")).join("\n");
  out = capitalizeSentences(out);
  for (const name of (opts.names ?? []).filter((n) => n && n.trim().length >= 3)) {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"), name.trim());
  }
  return out;
}

/**
 * A draft is read hours or days after it is written, so a time-of-day greeting ("Selamat sore") is often wrong.
 * An opening greeting is replaced by a neutral one; greetings inside the text are left alone.
 */
export function neutralGreeting(text: string): string {
  return text.replace(/^(selamat\s+(?:pagi|siang|sore|malam)|good\s+(?:morning|afternoon|evening|night))\b/i, (m) => (/^selamat/i.test(m) ? "Halo" : "Hello"));
}
