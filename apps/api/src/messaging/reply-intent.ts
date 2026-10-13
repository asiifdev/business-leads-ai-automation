/**
 * Understand what a prospect's reply means so the pipeline can follow it to closing.
 * Rule-based on purpose: free, instant, predictable, and testable. A wrong guess only changes a label
 * and a stage the owner can correct; it never sends anything.
 */
export type ReplyIntent = "auto_reply" | "interested" | "meeting" | "price" | "question" | "not_now" | "not_interested" | "other";

export const STAGE_ORDER = ["new", "contacted", "replied", "meeting", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGE_ORDER)[number];

const RULES: { intent: ReplyIntent; patterns: RegExp[] }[] = [
  {
    // a shop's automatic greeting is not a person answering: it must not move the deal or call for an answer
    intent: "auto_reply",
    patterns: [
      /\bterima\s*kasih\s+(telah|sudah|atas)\s+(menghubungi|mengirim|pesan|kontak)/i,
      /\bada\s+yang\s+(dapat|bisa)\s+(kami\s+|saya\s+)?(bantu|dibantu)\b/i,
      /\b(silah?kan|silakan)\s+(beri\s*tahu|kasih\s*tahu|beri\s*tau|sampaikan)\b/i,
      /\b(operational|operasional|opening)\s+(hour|hours|time)\b|\bjam\s+(operasional|buka|kerja)\b/i,
      /\bkatalog\b[\s\S]{0,80}(https?:|wa\.me|instagram)/i,
      /\b(pesan|balasan)\s+otomatis\b|\bauto[\s-]?repl(y|ies)\b|\bautomated\s+(message|reply)\b/i,
      /\b(jam|waktu)\s+(operasional|layanan|buka)\b/i,
      /\bsilakan\s+(pilih|ketik|klik|isi)\b/i,
      /\bthank\s+you\s+for\s+(contacting|messaging|reaching)\b/i,
      /\b(mohon|harap|silakan)\s+(menunggu|bersabar|sabar|tunggu)\b/i,
      /\bakan\s+(segera\s+)?(kami\s+)?(balas|membalas|respon|merespon|tanggapi|menanggapi|hubungi|menghubungi)\b/i,
      /\bsesuai\s+(antrian|antrean)\b|\bslow\s+respon\b/i,
      /\bpesan\s+(kakak|kak|anda|bapak|ibu)\s+(sudah|telah)\s+(kami\s+)?(terima|diterima)\b/i,
      /\b(terhubung|tersambung)\s+dengan\s+(customer|cs|admin|tim)\b|\bsedang\s+melayani\b/i,
      /\bselamat\s+datang\s+di\b|\bsudah\s+(saya|kami)\s+teruskan\b|\bakan\s+menindaklanjuti\b/i,
      /\b(kami|toko)\s+(buka|tutup)\s+(dari|jam|pukul)\b|\bjam\s+(buka|kerja)\b/i,
    ],
  },
  {
    intent: "not_interested",
    patterns: [
      /\b(tidak|nggak|gak|ga|belum)\s+(tertarik|berminat|butuh|perlu|minat)\b/i,
      /\bsudah\s+(punya|pakai|ada|menggunakan)\b/i,
      /\bnot\s+(interested|needed)\b/i,
      /\b(no\s+thanks|no\s+thank\s+you|we\s+(already\s+)?(have|use))\b/i,
      /\bsalah\s+(orang|nomor|alamat)\b/i,
    ],
  },
  {
    intent: "not_now",
    patterns: [
      /\b(nanti|lain\s+kali|bulan\s+depan|tahun\s+depan|minggu\s+depan|kapan-kapan)\b/i,
      /\b(belum\s+(saatnya|waktunya)|saat\s+ini\s+belum|sedang\s+sibuk)\b/i,
      /\b(maybe\s+later|not\s+right\s+now|not\s+now|next\s+(month|quarter|year)|too\s+busy)\b/i,
    ],
  },
  {
    intent: "meeting",
    patterns: [
      /\b(demo|presentasi|zoom|meet|google\s+meet|video\s+call|telepon|telp|call)\b/i,
      /\b(bisa|boleh|mau|ayo)\s+(ketemu|bertemu|jadwal|janjian|ngobrol|bicara)\b/i,
      /\b(jadwalkan|atur\s+jadwal|schedule|book\s+a\s+(call|demo)|let'?s\s+(talk|chat|meet))\b/i,
    ],
  },
  {
    intent: "price",
    patterns: [
      /\b(harga|biaya|tarif|paket|berapa|ongkos|bayar|langganan|promo|diskon)\b/i,
      /\b(price|pricing|cost|how\s+much|quote|plan|subscription)\b/i,
    ],
  },
  {
    intent: "interested",
    patterns: [
      /\b(tertarik|berminat|minat|boleh|mau\s+(coba|tahu|lihat|dengar)|coba\s+dong|kirim(kan)?\s+(info|detail|penawaran|proposal)|lanjut|oke\s+lanjut)\b/i,
      /\b(interested|sounds\s+good|send\s+(me\s+)?(more|info|details|a\s+proposal)|tell\s+me\s+more|let'?s\s+do\s+it)\b/i,
    ],
  },
  {
    intent: "question",
    patterns: [/\?/, /\b(apa|bagaimana|gimana|kenapa|apakah|siapa|dimana|di\s+mana|bisa\s+(untuk|buat))\b/i, /\b(what|how|why|can\s+you|does\s+it|is\s+it)\b/i],
  },
];

export function classifyReply(text: string): ReplyIntent {
  const full = text.trim();
  const t = full.slice(0, 600);
  if (!t) return "other";
  // a long, many-line message full of formatting is a shop's canned greeting, not a person typing back
  if (full.length > 350 && full.split(/\n/).length >= 4 && !/\?\s*$/.test(full.slice(0, 120))) return "auto_reply";
  for (const r of RULES) if (r.patterns.some((p) => p.test(t))) return r.intent;
  return "other";
}

export interface ReplyOutcome {
  intent: ReplyIntent;
  /** New stage, or null to keep the current one. Stages only move forward here; "lost" is never set automatically. */
  stage: Stage | null;
  /** Needs a human to answer. */
  needsReply: boolean;
  /** Days until the owner should look again, when the lead asked for time. */
  followUpInDays: number | null;
}

const rank = (s: string) => STAGE_ORDER.indexOf(s as Stage);

/** What a reply should change on the lead. Never moves a deal backwards and never closes one on its own. */
export function planReplyOutcome(currentStage: string, intent: ReplyIntent): ReplyOutcome {
  const forward = (target: Stage): Stage | null => (rank(currentStage) >= 0 && rank(currentStage) < rank(target) && !["won", "lost"].includes(currentStage) ? target : null);
  switch (intent) {
    case "auto_reply":
      return { intent, stage: null, needsReply: false, followUpInDays: null };
    case "meeting":
      return { intent, stage: forward("meeting"), needsReply: true, followUpInDays: null };
    case "interested":
    case "price":
    case "question":
      return { intent, stage: forward("replied"), needsReply: true, followUpInDays: null };
    case "not_now":
      return { intent, stage: forward("replied"), needsReply: false, followUpInDays: 30 };
    case "not_interested":
      // a human decides whether to close it as lost: it may be a polite brush-off or a real objection
      return { intent, stage: forward("replied"), needsReply: true, followUpInDays: null };
    default:
      return { intent, stage: forward("replied"), needsReply: true, followUpInDays: null };
  }
}

/** A shop's automatic greeting answers within seconds; a person almost never does. Only a clear intent keeps it from counting as automatic. */
export const AUTO_REPLY_WINDOW_MS = 45_000;
const CLEAR_INTENT = /\b(harga|berapa|biaya|tarif|tertarik|berminat|boleh|mau|demo|jelaskan|kirim(kan)?|info|coba)\b/i;

export function looksAutomaticByTiming(text: string, msSinceOurMessage: number | null): boolean {
  if (msSinceOurMessage === null || msSinceOurMessage < 0 || msSinceOurMessage > AUTO_REPLY_WINDOW_MS) return false;
  return !CLEAR_INTENT.test(text);
}
