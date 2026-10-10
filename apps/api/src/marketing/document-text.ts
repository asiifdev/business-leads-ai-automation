import { BadRequestException } from "@nestjs/common";
import { unzipSync } from "fflate";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

export const MAX_TEXT_FILE_BYTES = 1_000_000;
export const MAX_DOCUMENT_BYTES = 10_000_000;
const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_PAGES = 60;
const MAX_DOCX_XML_BYTES = 8_000_000;
const PDF_TIMEOUT_MS = 25_000;

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Removes tags in one forward pass (a regex like /<[^>]+>/ turns quadratic on text full of "<" without ">"). Paragraph ends become newlines. */
function stripXml(xml: string, maxChars: number): string {
  const out: string[] = [];
  let size = 0;
  let i = 0;
  const n = xml.length;
  while (i < n && size < maxChars) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) {
      out.push(xml.slice(i));
      break;
    }
    if (lt > i) {
      const t = xml.slice(i, lt);
      out.push(t);
      size += t.length;
    }
    const gt = xml.slice(lt, lt + 2_048).indexOf(">");
    if (gt < 0) { // not a tag: keep the "<" as text and move on
      out.push("<");
      size++;
      i = lt + 1;
      continue;
    }
    const tag = xml.slice(lt + 1, lt + gt);
    if (tag === "/w:p") out.push("\n");
    else if (tag.startsWith("w:tab")) out.push("\t");
    else if (tag.startsWith("w:br")) out.push("\n");
    i = lt + gt + 1;
  }
  return out.join("");
}

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
  return stripXml(xml, MAX_TEXT_CHARS * 2)
    .replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
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
}

/**
 * PDF parsing is CPU work that cannot be interrupted from the same thread, so it runs in a worker that is killed on
 * timeout and limited in memory: a hostile PDF can hurt only its own worker, never the API's event loop.
 * (unpdf is an ES module and the API is CommonJS, hence the dynamic import inside the worker.)
 */
const PDF_WORKER = `
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  try {
    const { getDocumentProxy, extractText } = await import(workerData.entry);
    const pdf = await getDocumentProxy(new Uint8Array(workerData.buffer));
    if (pdf.numPages > workerData.maxPages) return parentPort.postMessage({ error: "pages", pages: pdf.numPages });
    const { text } = await extractText(pdf, { mergePages: true });
    parentPort.postMessage({ text: String(text).slice(0, workerData.maxChars) });
  } catch (e) {
    parentPort.postMessage({ error: "read" });
  }
})();
`;

export function pdfToText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const entry = pathToFileURL(require.resolve("unpdf").replace(/index\.cjs$/, "index.mjs")).href;
    const worker = new Worker(PDF_WORKER, {
      eval: true,
      workerData: { buffer: new Uint8Array(buffer), entry, maxPages: MAX_PDF_PAGES, maxChars: MAX_TEXT_CHARS * 2 },
      resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 64 },
    });
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new BadRequestException("Reading that PDF took too long"))), PDF_TIMEOUT_MS);
    worker.on("message", (m: { text?: string; error?: string; pages?: number }) =>
      finish(() => {
        if (m.error === "pages") reject(new BadRequestException(`That PDF has ${m.pages} pages. Up to ${MAX_PDF_PAGES} are supported: export the relevant pages.`));
        else if (m.error) reject(new BadRequestException("That PDF could not be read. It may be damaged or password protected."));
        else resolve(m.text ?? "");
      }),
    );
    worker.on("error", () => finish(() => reject(new BadRequestException("That PDF could not be read. It may be damaged or too large to process."))));
    worker.on("exit", () => finish(() => reject(new BadRequestException("That PDF could not be read."))));
  });
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
