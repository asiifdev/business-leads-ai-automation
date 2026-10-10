import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { docxToText, extractDocumentText, pdfToText } from "./document-text";

function docx(body: string) {
  return Buffer.from(zipSync({ "word/document.xml": strToU8(`<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`) }));
}

test("docx: paragraphs, tabs, entities", () => {
  const t = docxToText(docx('<w:p><w:r><w:t>Paket Starter &amp; Pro</w:t></w:r></w:p><w:p><w:r><w:t>Harga</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Rp 1.500.000</w:t></w:r></w:p>'));
  assert.equal(t, "Paket Starter & Pro\nHarga Rp 1.500.000");
});

test("docx: not a zip, or no document.xml, is refused", () => {
  assert.throws(() => docxToText(Buffer.from("bukan zip")));
  assert.throws(() => docxToText(Buffer.from(zipSync({ "other.xml": strToU8("<a/>") }))));
});

test("extractDocumentText: text files, size and binary checks, unknown types", async () => {
  assert.match(await extractDocumentText({ originalname: "Harga.MD", buffer: Buffer.from("# Harga\nPaket mulai Rp 150.000 per hari untuk kamera.") }), /^# Harga/);
  await assert.rejects(extractDocumentText({ originalname: "x.txt", buffer: Buffer.from("a\u0000b".repeat(20)) }), /not plain text/);
  await assert.rejects(extractDocumentText({ originalname: "x.txt", buffer: Buffer.alloc(1_000_001, "a") }), /1 MB/);
  await assert.rejects(extractDocumentText({ originalname: "x.exe", buffer: Buffer.from("MZ") }), /Supported files/);
  await assert.rejects(extractDocumentText({ originalname: "x.pdf", buffer: Buffer.from("bukan pdf sama sekali, hanya teks") }), /not a PDF/);
  await assert.rejects(extractDocumentText({ originalname: "kosong.md", buffer: Buffer.from("hai") }), /almost no text/);
});

test("pdf: reads the text of a real PDF and refuses damaged ones", async () => {
  // a minimal one-page PDF whose content stream shows "Sistem manajemen sewa kamera"
  const content = "BT /F1 18 Tf 20 100 Td (Sistem manajemen sewa kamera) Tj ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  assert.match(await pdfToText(Buffer.from(pdf)), /Sistem manajemen sewa kamera/);
  await assert.rejects(pdfToText(Buffer.from("%PDF-1.4 rusak")), /could not be read/);
});

test("hostile documents are processed in linear time", () => {
  const bombs = [
    "<".repeat(2_000_000),
    "<w:p>".repeat(500_000),
    "<w:t".repeat(400_000),
    "&#".repeat(500_000),
  ];
  for (const xml of bombs) {
    const t0 = Date.now();
    docxToText(Buffer.from(zipSync({ "word/document.xml": strToU8(xml) })));
    assert.ok(Date.now() - t0 < 2500, `took ${Date.now() - t0} ms`);
  }
});

test("a damaged PDF never blocks the event loop: it fails inside a worker", async () => {
  let ticks = 0;
  const timer = setInterval(() => ticks++, 10);
  await assert.rejects(pdfToText(Buffer.from("%PDF-1.7\n" + "1 0 obj << /Length 99999999 >> stream\n".repeat(20_000))), /could not be read|too long/);
  clearInterval(timer);
  assert.ok(ticks > 3, "the event loop kept running while the PDF was parsed");
});
