/**
 * WhatsApp has its own formatting: *bold*, _italic_, ~strike~, `mono`, "- " lists, "> " quotes, and blank lines between paragraphs.
 * Models write Markdown (**bold**, # headings, * bullets) or leave symbols unbalanced, which WhatsApp shows literally.
 * This turns what the model wrote into clean WhatsApp text: valid spans kept, Markdown converted, stray symbols removed,
 * emphasis kept sparing, and paragraphs spaced so the message reads well on a phone.
 */
const MAX_BOLD = 4;
const MAX_BOLD_LENGTH = 60;
const MARK = "\u0001";

export function toWhatsapp(input: string): string {
  let text = input.replace(/\r\n?/g, "\n");

  // Markdown -> WhatsApp
  text = text
    .replace(/^#{1,6}\s+(.+?)\s*:?\s*$/gm, "*$1*")
    .replace(/\*\*([^*\n]+?)\*\*/g, "*$1*")
    .replace(/__([^_\n]+?)__/g, "_$1_")
    .replace(/~~([^~\n]+?)~~/g, "~$1~")
    .replace(/^[ \t]*[*•·▪‣]\s+/gm, "- ")
    .replace(/^[ \t]*-\s+/gm, "- ")
    .replace(/^[ \t]*(\d{1,2})[.)]\s+/gm, "$1. ");

  // A span only counts when the symbols hug the text: "* word *" is not bold. Protect valid spans, drop the rest.
  const spans: string[] = [];
  let bold = 0;
  text = text.replace(/(^|[\s(])([*_~])([^\s*_~](?:[^*_~\n]*?[^\s*_~])?)\2(?=[\s).,!?:;]|$)/gm, (_m, pre: string, mark: string, body: string) => {
    if (mark === "*") {
      bold++;
      if (bold > MAX_BOLD || body.length > MAX_BOLD_LENGTH) return `${pre}${body}`; // emphasis everywhere is emphasis nowhere
    }
    spans.push(`${mark}${body}${mark}`);
    return `${pre}${MARK}${spans.length - 1}${MARK}`;
  });
  text = text.replace(/\*+/g, "").replace(/~+/g, "").replace(/(^|\s)_+|_+(?=\s|$)/g, "$1");
  text = text.replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"), (_m, i: string) => spans[Number(i)]);

  // spacing
  text = text.replace(/[ \t]+$/gm, "").replace(/(\S)[ \t]{2,}/g, "$1 ").replace(/\n{3,}/g, "\n\n").trim();
  const lines = text.split("\n");
  const isList = (l: string) => /^(- |\d{1,2}\. )/.test(l);
  const out: string[] = [];
  lines.forEach((line, i) => {
    const prev = out[out.length - 1];
    // a list gets a blank line before and after it
    if (prev !== undefined && prev !== "" && line !== "" && isList(line) !== isList(prev)) out.push("");
    out.push(line);
    void i;
  });
  text = out.join("\n");

  // one unbroken block of four or more sentences: greeting, body and closing line each get their own paragraph
  if (!text.includes("\n")) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length >= 4) {
      const greeting = /^(halo|hai|hello|selamat)\b/i.test(sentences[0]) ? sentences.shift()! : "";
      const closing = sentences.length >= 3 ? sentences.pop()! : "";
      text = [greeting, sentences.join(" "), closing].filter(Boolean).join("\n\n");
    }
  }
  return text;
}
