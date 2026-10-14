import { BadRequestException, HttpException } from "@nestjs/common";
import { extractImageThumb } from "@whiskeysockets/baileys";
import { fetchResource, validatePublicUrl } from "../marketing/url-fetch";

/**
 * The card WhatsApp shows under a link: title, description and a small picture.
 * Baileys sends the card; it can also build one, but its own builder needs a package that is not installed and opens the page
 * without our address checks. So the page and the picture are fetched here, through url-fetch.ts, and handed to Baileys ready-made.
 */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  /** Base64 JPEG, about 192 px wide. Absent when the page has no usable picture. */
  thumbnail?: string;
}

const HEAD_CHARS = 150_000;
const MAX_TAGS = 400;
const MAX_TAG_CHARS = 800;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Value of one attribute inside a single tag (a short slice, so a simple search is safe). */
function attr(tag: string, name: string): string | null {
  const lower = tag.toLowerCase();
  let from = 0;
  for (let i = 0; i < 12; i++) {
    const at = lower.indexOf(name, from);
    if (at < 0) return null;
    from = at + name.length;
    const before = lower[at - 1];
    if (at > 0 && before !== " " && before !== "\n" && before !== "\t" && before !== '"' && before !== "'") continue;
    let j = from;
    while (lower[j] === " ") j++;
    if (lower[j] !== "=") continue;
    j++;
    while (lower[j] === " ") j++;
    const q = tag[j];
    if (q === '"' || q === "'") {
      const end = tag.indexOf(q, j + 1);
      return end < 0 ? null : tag.slice(j + 1, end);
    }
    let end = j;
    while (end < tag.length && tag[end] !== " " && tag[end] !== ">") end++;
    return tag.slice(j, end);
  }
  return null;
}

/**
 * Open Graph / Twitter / plain-HTML fields of a page. One forward pass over the start of the page: every search moves forward,
 * tags are read in a short window, and the number of tags is capped, so hostile HTML cannot make it slow.
 */
export function parseLinkPreview(rawHtml: string, pageUrl: string): { title: string; description: string; image: string | null } {
  const html = rawHtml.slice(0, HEAD_CHARS);
  const lower = html.toLowerCase();
  const meta = new Map<string, string>();
  let pos = 0;
  for (let n = 0; n < MAX_TAGS; n++) {
    const at = lower.indexOf("<meta", pos);
    if (at < 0) break;
    const end = lower.indexOf(">", at);
    if (end < 0 || end - at > MAX_TAG_CHARS) { pos = at + 5; continue; }
    const tag = html.slice(at, end + 1);
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
    pos = end + 1;
  }
  let title = "";
  const t0 = lower.indexOf("<title");
  if (t0 >= 0) {
    const open = lower.indexOf(">", t0);
    const close = open >= 0 ? lower.indexOf("</title", open) : -1;
    if (open >= 0 && close >= 0 && close - open < 600) title = html.slice(open + 1, close);
  }
  const clean = (s: string | undefined, max: number) => decode(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const image = meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image") ?? null;
  let imageUrl: string | null = null;
  if (image) {
    try {
      const u = new URL(decode(image).trim(), pageUrl);
      imageUrl = u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; // never javascript:, data: or file:
    } catch { imageUrl = null; }
  }
  return {
    title: clean(meta.get("og:title") ?? meta.get("twitter:title") ?? title, 120),
    description: clean(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), 200),
    image: imageUrl,
  };
}

/** The first web address in a text, the one WhatsApp would put a card on. */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')\]]{3,300}/i);
  return m ? m[0].replace(/[.,!?;:]+$/, "") : null;
}

/** Builds the card for one link. Throws a readable error for an address that is not allowed or cannot be opened. */
export async function buildLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const url = validatePublicUrl(rawUrl).toString();
  const page = await fetchResource(url, { maxBytes: 600_000 });
  const info = parseLinkPreview(page.body, page.url);
  if (!info.title) throw new Error("That page has no title to show in a preview");
  let thumbnail: string | undefined;
  if (info.image) {
    try {
      const img = await fetchResource(info.image, { types: /^image\/(jpeg|png|webp)/i, maxBytes: 2_000_000, accept: "image/jpeg,image/png,image/webp" });
      const thumb = await extractImageThumb(img.bytes, 192);
      if (thumb.buffer.length > 0 && thumb.buffer.length <= 40_000) thumbnail = thumb.buffer.toString("base64");
    } catch {
      // a card without a picture is still a card
    }
  }
  return { url: page.url, title: info.title, description: info.description, thumbnail };
}

/** The card for the first link in a message text, with errors the owner can read (no link, address not allowed, page not reachable). */
export async function previewForText(text: string): Promise<LinkPreview> {
  const url = firstUrl(text);
  if (!url) throw new BadRequestException("Write a link (https://...) in the message first, then ask for its preview");
  try {
    return await buildLinkPreview(url);
  } catch (e) {
    throw e instanceof HttpException ? e : new BadRequestException((e as Error).message);
  }
}

/**
 * The card a message should carry. `requested`: true = the owner asked for it (a failure is an error they must see),
 * false = they turned it off, undefined = automatic: a link in the text gets a card when one can be built, and a page that
 * cannot be read simply goes out without one, because a link with no card looks unfinished but must not block the message.
 */
export async function maybePreview(text: string, requested: boolean | undefined, hasAttachment: boolean, build: (text: string) => Promise<LinkPreview> = previewForText): Promise<LinkPreview | null> {
  if (hasAttachment || requested === false) return null; // a file's caption shows no card
  if (!firstUrl(text)) {
    if (requested === true) throw new BadRequestException("Write a link (https://...) in the message first, then ask for its preview");
    return null;
  }
  try {
    return await build(text);
  } catch (e) {
    if (requested === true) throw e;
    return null;
  }
}
