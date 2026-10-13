import type { ReplyIntent } from "./reply-intent";

/**
 * What a reply should DO, decided by rules before any model writes a word. The model only phrases it.
 * Small local models invent a different "plan" every time (introducing themselves again, answering a question nobody asked);
 * choosing the action in code and checking the result afterwards removes most of that.
 */
export type ReplyAction = "none" | "thanks_close" | "thanks_wait" | "thanks_later" | "answer" | "next_step";

const FORWARDED = /\b(teruskan|diteruskan|info(kan)?\s+(ke|kepada)\s+(atas|pimpinan|owner|manager|tim)|keatasan|ke\s*atasan|atasan|pimpinan|owner|tim\s+kami|kami\s+(cek|diskusi|bahas|konsultasikan)|nanti\s+kami\s+(kabari|hubungi))\b/i;

export function planReplyAction(intent: ReplyIntent, text: string): ReplyAction {
  if (intent === "auto_reply") return "none";
  if (intent === "not_interested") return "thanks_close";
  if (intent === "not_now") return "thanks_later";
  if (FORWARDED.test(text)) return "thanks_wait";
  if (intent === "price" || intent === "question") return "answer";
  if (intent === "interested" || intent === "meeting") return "next_step";
  return text.trim().length < 25 ? "thanks_wait" : "answer";
}

/** Fixed wording for the actions that need no facts. Polite, humble, no emoji, no guessed honorific. */
export function templateReply(action: ReplyAction, language: "indonesian" | "english"): string | null {
  const id = language === "indonesian";
  switch (action) {
    case "thanks_close":
      return id ? "Baik, Kak. Terima kasih sudah membalas, dan mohon maaf kalau mengganggu. Semoga usahanya makin lancar." : "Understood, and thank you for replying. Sorry to have disturbed you. I wish your business well.";
    case "thanks_wait":
      return id ? "Baik, Kak. Terima kasih banyak. Saya tunggu kabarnya, dan kalau ada yang ingin ditanyakan, silakan kapan saja." : "Thank you very much. I will wait to hear from you, and please ask me anything at any time.";
    case "thanks_later":
      return id ? "Baik, Kak, terima kasih sudah membalas. Saya hubungi lagi nanti. Kalau ada yang ingin ditanyakan sebelum itu, silakan." : "Thank you for replying. I will get back to you later. If you have any question before then, please ask.";
    default:
      return null;
  }
}

/** Safe wording when the model could not produce a reply that passes the checks. A person still reviews it. */
export function fallbackReply(action: ReplyAction, language: "indonesian" | "english"): string {
  const id = language === "indonesian";
  if (action === "next_step") return id ? "Terima kasih sudah membalas, Kak. Boleh saya kirimkan contoh tampilannya, atau saya jelaskan singkat lewat demo?" : "Thank you for replying. May I send you an example, or explain briefly in a short demo?";
  return id ? "Terima kasih sudah membalas, Kak. Saya kirimkan rincian yang Kakak butuhkan ya. Mohon beri tahu bagian mana yang ingin diketahui lebih dulu." : "Thank you for replying. I will send the details you need. Please tell me which part you would like to know first.";
}

const COMMANDING = /\b(siap+|oke+|gas|yuk|aja|kabari\s+saja|kabarin|coba\s+dulu|kirim\s+ke\s+sini|langsung\s+aja)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const INTRO = /\b(saya|kami)\s+dari\b|\bperkenalkan\b/i;

/** Why a drafted reply should not be shown as is. Empty means it passes. */
export function checkReply(text: string, o: { alreadyIntroduced: boolean; knownText: string }): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (t.length < 8) problems.push("too short");
  if (t.length > 360) problems.push("too long");
  if (EMOJI.test(t)) problems.push("emoji");
  if (COMMANDING.test(t)) problems.push("commanding tone");
  if (o.alreadyIntroduced && INTRO.test(t)) problems.push("introduces itself again");
  if (/\bMbak\b|\bMas\b|\bBapak\b|\bIbu\b/.test(t)) problems.push("guessed honorific");
  const urls = t.match(/https?:\/\/\S+/g) ?? [];
  if (urls.some((u) => !o.knownText.includes(u))) problems.push("unknown link");
  return problems;
}
