/**
 * What may be attached to a WhatsApp message. The type comes from the file's own first bytes, never from the name or the
 * type the browser claims, so an .exe renamed to .pdf, an HTML page or an SVG with a script cannot be stored or sent.
 */
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024; // WhatsApp's limit for photos and videos; a document may be larger but 16 MB is plenty for a brochure

/** WhatsApp shows at most this many characters as a file's caption; a longer text goes out as its own message right after the file. */
export const CAPTION_LIMIT = 1024;

export type AttachmentKind = "image" | "video" | "document";
export interface SniffedFile { mime: string; kind: AttachmentKind; ext: string }

const OFFICE: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const startsWith = (buf: Buffer, bytes: number[], at = 0) => buf.length >= at + bytes.length && bytes.every((b, i) => buf[at + i] === b);

export function sniffAttachment(buf: Buffer, fileName: string): SniffedFile | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", kind: "document", ext: "pdf" };
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", kind: "image", ext: "jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", kind: "image", ext: "png" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", kind: "image", ext: "webp" };
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) return { mime: "video/mp4", kind: "video", ext: "mp4" };
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // Office files are ZIP archives; the extension picks which one, and only these three are accepted
    const ext = fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";
    if (OFFICE[ext]) return { mime: OFFICE[ext], kind: "document", ext };
  }
  return null;
}

/** A name that is safe to show and to send: no path, no control characters, the real extension, at most 80 characters. */
export function safeFileName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const stem = base.replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
  return `${stem || "lampiran"}.${ext}`;
}
