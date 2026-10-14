/**
 * The readable text of a WhatsApp message. Replies often come as a photo with a caption ("Untuk fleet cm segini") or inside a
 * wrapper (disappearing messages, view-once), and the owner's own messages from their phone are often a PDF or a picture.
 * Both matter to the conversation, so they are read here instead of being dropped.
 */
export interface WaMessageLike {
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null } | null;
  imageMessage?: { caption?: string | null } | null;
  videoMessage?: { caption?: string | null } | null;
  documentMessage?: { caption?: string | null; fileName?: string | null } | null;
  documentWithCaptionMessage?: { message?: WaMessageLike | null } | null;
  ephemeralMessage?: { message?: WaMessageLike | null } | null;
  viewOnceMessage?: { message?: WaMessageLike | null } | null;
  viewOnceMessageV2?: { message?: WaMessageLike | null } | null;
  contactMessage?: { displayName?: string | null; vcard?: string | null } | null;
  contactsArrayMessage?: { contacts?: { displayName?: string | null; vcard?: string | null }[] | null } | null;
  audioMessage?: object | null;
  stickerMessage?: object | null;
}

function unwrap(m: WaMessageLike | null | undefined, depth = 0): WaMessageLike | null {
  if (!m || depth > 4) return m ?? null;
  const inner = m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ?? m.viewOnceMessageV2?.message ?? m.documentWithCaptionMessage?.message;
  return inner ? unwrap(inner, depth + 1) : m;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

/** Phone numbers in a vCard: the WhatsApp id when present ("waid=628..."), else the TEL line. */
export function vcardPhones(vcard: string | null | undefined): string[] {
  const out = new Set<string>();
  for (const line of (vcard ?? "").slice(0, 4000).split(/\r?\n/)) {
    if (!/^TEL/i.test(line)) continue;
    const wa = line.match(/waid=(\d{8,15})/i)?.[1];
    const raw = wa ?? line.slice(line.indexOf(":") + 1).replace(/[^\d+]/g, "");
    const digits = raw.replace(/\D/g, "");
    // a number that starts with 0 is local (no country code known here), so it must not get a "+"
    if (digits.length >= 8 && digits.length <= 15) out.add(digits.startsWith("0") ? digits : `+${digits}`);
  }
  return [...out];
}

function contactCards(m: WaMessageLike): string {
  const cards = [...(m.contactMessage ? [m.contactMessage] : []), ...(m.contactsArrayMessage?.contacts ?? [])].slice(0, 5);
  return cards.map((c) => `[Kontak: ${clean(c.displayName).slice(0, 60) || "tanpa nama"}${vcardPhones(c.vcard).length ? ` ${vcardPhones(c.vcard).join(", ")}` : ""}]`).join(" ");
}

/**
 * `markers`: when a message has no words (a PDF, a picture), return a short marker such as "[Dokumen: Brosur.pdf]" so the
 * thread shows that something was sent. Use it for the owner's own messages; for replies a marker is not a reply, so it is off.
 */
export function messageText(message: WaMessageLike | null | undefined, opts: { markers?: boolean } = {}): string {
  const m = unwrap(message);
  if (!m) return "";
  const words = clean(m.conversation) || clean(m.extendedTextMessage?.text) || clean(m.imageMessage?.caption) || clean(m.videoMessage?.caption) || clean(m.documentMessage?.caption);
  const marker = m.documentMessage ? `[Dokumen: ${clean(m.documentMessage.fileName).slice(0, 80) || "file"}]` : m.imageMessage ? "[Gambar]" : m.videoMessage ? "[Video]" : m.audioMessage ? "[Pesan suara]" : m.stickerMessage ? "[Stiker]" : "";
  // a shared contact is content, not a decoration: someone passing us on to another number is exactly what must not be lost
  const cards = contactCards(m);
  if (cards) return words ? `${cards} ${words}` : cards;
  if (!opts.markers) return words;
  if (words && marker) return `${marker} ${words}`;
  return words || marker;
}

export interface Referral { name: string | null; phone: string }

/** The contacts someone passed us: shared cards ("[Kontak: Nama +62...]") and numbers written in the text. At most 5. */
export function parseReferrals(text: string): Referral[] {
  const out: Referral[] = [];
  const seen = new Set<string>();
  const add = (name: string | null, phone: string) => {
    const key = phone.replace(/\D/g, "");
    if (key.length < 8 || key.length > 15 || seen.has(key) || out.length >= 5) return;
    seen.add(key);
    out.push({ name, phone });
  };
  for (const m of text.slice(0, 4000).matchAll(/\[Kontak:\s*([^\]]{0,160})\]/gi)) {
    const body = m[1].trim();
    const nums = [...body.matchAll(/\+?\d[\d\s-]{6,}\d/g)].map((n) => n[0].trim());
    const name = body.replace(/\+?\d[\d\s-]{6,}\d/g, "").replace(/[,\s]+$/g, "").trim() || null;
    for (const n of nums) add(name === "tanpa nama" ? null : name, n);
  }
  const outside = text.replace(/\[Kontak:[^\]]*\]/gi, " ");
  for (const m of outside.slice(0, 4000).matchAll(/(?<![\d+])(\+?62|0)8[\d\s-]{7,13}\d/g)) add(null, m[0].trim());
  return out;
}
