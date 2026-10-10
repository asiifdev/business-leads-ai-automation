import { BadRequestException } from "@nestjs/common";
import { unzipSync } from "fflate";

export const MAX_TEXT_FILE_BYTES = 1_000_000;
export const MAX_DOCUMENT_BYTES = 10_000_000;
const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_PAGES = 60;
const MAX_DOCX_XML_BYTES = 20_000_000;
const PDF_TIMEOUT_MS = 25_000;

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Text of a .docx: only word/document.xml is unzipped (and size-checked first), so a zip bomb cannot expand. */
export function docxToText(buffer: Buffer): string {
  let xml = "";
  try {
    const files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => {
        if (f.name !== "word/document.xml") return false;
        if (f.originalSize > MAX_DOCX_XML_BYTES) throw new Error("too large once unzipped");
        return true;
      },
    });
    xml = Buffer.from(files["word/document.xml"] ?? new Uint8Array()).toString("utf-8");
  } catch (e) {
    throw new BadRequestException(/too large/.test((e as Error).message) ? "That document is too large once opened" : "That file is not a valid .docx document");
  }
  if (!xml) throw new BadRequestException("That file is not a valid .docx document");
  const text = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : "";
      }
      return XML_ENTITIES[e.toLowerCase()] ?? m;
    })
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

// unpdf is ES-module only; the API is compiled to CommonJS, so it is loaded with a runtime import.
const importEsm = new Function("s", "return import(s)") as (s: string) => Promise<typeof import("unpdf")>;

export async function pdfToText(buffer: Buffer): Promise<string> {
  const work = (async () => {
    const { getDocumentProxy, extractText } = await importEsm("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages > MAX_PDF_PAGES) throw new BadRequestException(`That PDF has ${pdf.numPages} pages. Up to ${MAX_PDF_PAGES} are supported: export the relevant pages.`);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  })();
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new BadRequestException("Reading that PDF took too long")), PDF_TIMEOUT_MS));
  try {
    return await Promise.race([work, timeout]);
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException("That PDF could not be read. It may be damaged or password protected.");
  }
}

/** Plain text from an uploaded document. Supports .md, .markdown, .txt, .docx and .pdf. */
export async function extractDocumentText(file: { originalname: string; buffer: Buffer }): Promise<string> {
  const name = file.originalname.toLowerCase();
  let text: string;
  if (/\.(md|markdown|txt)$/.test(name)) {
    if (file.buffer.byteLength > MAX_TEXT_FILE_BYTES) throw new BadRequestException("Text files can be up to 1 MB");
    text = file.buffer.toString("utf-8");
    if (text.includes("\u0000")) throw new BadRequestException("That file is not plain text");
  } else if (name.endsWith(".docx")) {
    if (file.buffer.byteLength > MAX_DOCUMENT_BYTES) throw new BadRequestException("Documents can be up to 10 MB");
    text = docxToText(file.buffer);
  } else if (name.endsWith(".pdf")) {
    if (file.buffer.byteLength > MAX_DOCUMENT_BYTES) throw new BadRequestException("Documents can be up to 10 MB");
    if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new BadRequestException("That file is not a PDF");
    text = await pdfToText(file.buffer);
  } else {
    throw new BadRequestException("Supported files: .pdf, .docx, .md and .txt. Export other documents to one of those first.");
  }
  text = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (text.replace(/\s+/g, " ").length < 30) {
    throw new BadRequestException(name.endsWith(".pdf") ? "This PDF has almost no text (it may be a scan or made of images). Paste the text instead." : "That file has almost no text");
  }
  return text.slice(0, MAX_TEXT_CHARS);
}
