import test from "node:test";
import assert from "node:assert/strict";
import { safeFileName, sniffAttachment } from "./attachment-file";

const b = (...bytes: number[]) => Buffer.from([...bytes, ...new Array(32).fill(0)]);

test("accepted types are recognised from their bytes", () => {
  assert.equal(sniffAttachment(Buffer.from("%PDF-1.7\n..."), "x.bin")?.mime, "application/pdf");
  assert.equal(sniffAttachment(b(0xff, 0xd8, 0xff, 0xe0), "x")?.kind, "image");
  assert.equal(sniffAttachment(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "x")?.mime, "image/png");
  assert.equal(sniffAttachment(Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]), "x")?.mime, "image/webp");
  assert.equal(sniffAttachment(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42")]), "x")?.kind, "video");
});

test("a ZIP is accepted only as docx, xlsx or pptx", () => {
  const zip = b(0x50, 0x4b, 0x03, 0x04);
  assert.equal(sniffAttachment(zip, "Penawaran.DOCX")?.ext, "docx");
  assert.equal(sniffAttachment(zip, "data.xlsx")?.kind, "document");
  assert.equal(sniffAttachment(zip, "archive.zip"), null);
  assert.equal(sniffAttachment(zip, "virus.exe"), null);
});

test("a renamed executable, a web page or an SVG is refused whatever the name says", () => {
  assert.equal(sniffAttachment(Buffer.from("MZ\x90\x00\x03"), "brosur.pdf"), null);
  assert.equal(sniffAttachment(Buffer.from("<!doctype html><script>alert(1)</script>"), "brosur.pdf"), null);
  assert.equal(sniffAttachment(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"), "logo.png"), null);
  assert.equal(sniffAttachment(Buffer.alloc(0), "x.pdf"), null);
});

test("the stored name has no path and carries the real extension", () => {
  assert.equal(safeFileName("../../etc/passwd.pdf", "pdf"), "passwd.pdf");
  assert.equal(safeFileName("C:\\x\\Brosur  Harga <2026>.exe", "pdf"), "Brosur Harga 2026.pdf");
  assert.equal(safeFileName("\u0000\u0001.pdf", "pdf"), "lampiran.pdf");
  assert.ok(safeFileName("a".repeat(300) + ".pdf", "pdf").length <= 75);
});
