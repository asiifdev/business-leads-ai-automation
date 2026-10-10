/**
 * Parser for WhatsApp's official "Export chat" text files (.txt, also the .txt inside the .zip).
 * Handles the Android and iOS layouts, 12h/24h clocks, "." or ":" time separators,
 * d/m/y vs m/d/y dates, multi-line messages, system lines and media placeholders.
 * Pure functions: no I/O, no database, no AI.
 */
export interface ParsedMessage {
  at: Date;
  sender: string;
  text: string;
  /** True when the message is only a media placeholder (image, video, sticker ...) */
  isMedia: boolean;
}

export interface ParsedChat {
  messages: ParsedMessage[];
  senders: string[];
  /** Lines that matched no header and could not be attached to a previous message. */
  skippedLines: number;
  systemLines: number;
  dateOrder: "dmy" | "mdy";
}

// Android:  21/07/26 16.49 - Name: text      iOS:  [21/07/26, 16.49.12] Name: text
const ANDROID = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*([APap]\.?[Mm]\.?)?\s+-\s+(.*)$/;
const IOS = /^\[(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*([APap]\.?[Mm]\.?)?\]\s+(.*)$/;

// Written as escapes on purpose: no invisible/bidi characters may live in source files.
const INVISIBLE = new RegExp("[" + ["\\u200e", "\\u200f", "\\u202a-\\u202e", "\\u2066-\\u2069", "\\ufeff"].join("") + "]", "g");

const MEDIA_ONLY = [
  /^<media (omitted|tidak disertakan)>$/i,
  /^<attached: .+>$/i,
  /^<lampiran: .+>$/i,
  /^(image|video|audio|sticker|gif|document|stiker|gambar|dokumen)\s+(omitted|tidak disertakan)$/i,
  /^.+\.(jpg|jpeg|png|webp|mp4|opus|m4a|pdf|vcf)\s*\((file attached|file terlampir)\)$/i,
  /^(?:IMG|VID|PTT|AUD|STK|DOC)-\d{8}-WA\d+\.\w+$/i,
  /^(missed voice call|missed video call|panggilan suara tak terjawab|panggilan video tak terjawab)$/i,
];
/**
 * Attachment markers can sit in front of a caption ("IMG-20240101-WA0001.jpg (file attached) caption text").
 * They are file names, not words the person wrote, so they are removed before any statistics are computed.
 */
const INLINE_MARKERS = new RegExp(
  [
    "<(?:attached|lampiran):[^>]*>",
    "<media (?:omitted|tidak disertakan)>",
    "<(?:this message was edited|pesan ini diedit)>",
    "(?:(?:IMG|VID|PTT|AUD|STK|DOC)-\\d{8}-WA\\d+\\.\\w+|\\S+\\.(?:jpe?g|png|webp|mp4|opus|m4a|pdf|vcf))(?:\\s*\\((?:file attached|file terlampir)\\))?",
  ].join("|"),
  "gi",
);

const DELETED = /^(this message was deleted|you deleted this message|pesan ini dihapus|anda menghapus pesan ini)$/i;

/** Largest export accepted (characters). Real exports are a few MB; this bounds work on hostile input. */
export const MAX_EXPORT_CHARS = 50_000_000;
/** Headers and media placeholders are short; longer lines are never matched against these patterns. */
const MAX_HEADER_CHARS = 400;
const MAX_MEDIA_PLACEHOLDER_CHARS = 200;

const clean = (s: string) => s.replace(INVISIBLE, "").trim();

interface Header {
  a: number;
  b: number;
  y: number;
  hour: number;
  minute: number;
  second: number;
  meridiem?: string;
  rest: string;
}

function matchHeader(line: string): Header | null {
  const head = line.slice(0, MAX_HEADER_CHARS);
  const m = ANDROID.exec(head) ?? IOS.exec(head);
  if (!m) return null;
  return {
    a: +m[1], b: +m[2], y: +m[3], hour: +m[4], minute: +m[5], second: m[6] ? +m[6] : 0,
    meridiem: m[7]?.toLowerCase().replace(/\./g, ""), rest: m[8],
  };
}

/** Day-first unless some message proves month-first (first number > 12 means day-first; second > 12 means month-first). */
function detectDateOrder(headers: Header[]): "dmy" | "mdy" {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const h of headers) {
    if (h.a > 12 && h.b <= 12) dayFirst++;
    if (h.b > 12 && h.a <= 12) monthFirst++;
  }
  return monthFirst > dayFirst ? "mdy" : "dmy";
}

function toDate(h: Header, order: "dmy" | "mdy"): Date {
  const day = order === "dmy" ? h.a : h.b;
  const month = order === "dmy" ? h.b : h.a;
  const year = h.y < 100 ? 2000 + h.y : h.y;
  let hour = h.hour;
  if (h.meridiem === "pm" && hour < 12) hour += 12;
  if (h.meridiem === "am" && hour === 12) hour = 0;
  return new Date(Date.UTC(year, month - 1, day, hour, h.minute, h.second));
}

/** Splits "Name: text". Returns null for system lines (no sender). */
function splitSender(rest: string): { sender: string; text: string } | null {
  const idx = rest.indexOf(": ");
  if (idx <= 0 || idx > 80) return null;
  return { sender: clean(rest.slice(0, idx)), text: rest.slice(idx + 2) };
}

export function parseWhatsAppExport(raw: string): ParsedChat {
  if (raw.length > MAX_EXPORT_CHARS) throw new RangeError("WhatsApp export is too large");
  const lines = raw.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n").split("\n");
  const found: { header: Header; lineIndex: number }[] = [];
  lines.forEach((l, i) => {
    const h = matchHeader(clean(l));
    if (h) found.push({ header: h, lineIndex: i });
  });
  const dateOrder = detectDateOrder(found.map((f) => f.header));

  const messages: ParsedMessage[] = [];
  let skipped = 0;
  let system = 0;
  let current: ParsedMessage | null = null;
  let headerPos = 0;

  for (let i = 0; i < lines.length; i++) {
    if (headerPos < found.length && found[headerPos].lineIndex === i) {
      const { header } = found[headerPos++];
      const parts = splitSender(header.rest);
      if (!parts) {
        system++;
        current = null; // system lines never absorb continuation text
        continue;
      }
      current = { at: toDate(header, dateOrder), sender: parts.sender, text: parts.text, isMedia: false };
      messages.push(current);
    } else if (current) {
      current.text += `\n${lines[i]}`;
    } else if (lines[i].trim()) {
      skipped++;
    }
  }

  const out: ParsedMessage[] = [];
  for (const m of messages) {
    const text = clean(m.text);
    if (!text || DELETED.test(text)) continue;
    const mediaOnly = text.length <= MAX_MEDIA_PLACEHOLDER_CHARS && MEDIA_ONLY.some((re) => re.test(text));
    const stripped = mediaOnly ? text : clean(text.replace(INLINE_MARKERS, " "));
    if (!mediaOnly && !stripped) {
      out.push({ ...m, text, isMedia: true }); // nothing but markers
      continue;
    }
    out.push({ ...m, text: stripped, isMedia: mediaOnly });
  }
  const senders = [...new Set(out.map((m) => m.sender))];
  return { messages: out, senders, skippedLines: skipped, systemLines: system, dateOrder };
}
