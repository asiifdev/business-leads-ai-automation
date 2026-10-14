import test from "node:test";
import assert from "node:assert/strict";
import { buildBaileysContent, planBaileysMessages } from "./baileys.provider";

const file = (kind: "image" | "video" | "document", mimeType: string, fileName = "a.bin") => ({ attachment: { data: Buffer.from("x"), mimeType, fileName, kind } });
const card = { url: "https://example.com/", title: "Contoh", description: "Jasa aplikasi", thumbnail: Buffer.from("jpg") };

test("a document carries the text as its caption, with its name and type", () => {
  const c = buildBaileysContent("Berikut brosurnya.", file("document", "application/pdf", "Brosur.pdf")) as Record<string, unknown>;
  assert.equal(c.caption, "Berikut brosurnya.");
  assert.equal(c.fileName, "Brosur.pdf");
  assert.equal(c.mimetype, "application/pdf");
  assert.ok(Buffer.isBuffer(c.document));
  assert.equal("text" in c, false);
});

test("an image and a video are sent as media with a caption", () => {
  const i = buildBaileysContent("Foto", file("image", "image/jpeg")) as Record<string, unknown>;
  const v = buildBaileysContent("Video", file("video", "video/mp4")) as Record<string, unknown>;
  assert.ok(Buffer.isBuffer(i.image) && i.caption === "Foto" && i.mimetype === "image/jpeg");
  assert.ok(Buffer.isBuffer(v.video) && v.caption === "Video");
});

test("a link card is built from the data given, for the address that is really in the text", () => {
  const c = buildBaileysContent("Lihat https://example.com/ ya.", { linkPreview: card }) as unknown as { text: string; linkPreview: Record<string, unknown> };
  assert.equal(c.text, "Lihat https://example.com/ ya.");
  assert.equal(c.linkPreview["canonical-url"], "https://example.com/");
  assert.equal(c.linkPreview["matched-text"], "https://example.com/");
  assert.equal(c.linkPreview.title, "Contoh");
  assert.ok(Buffer.isBuffer(c.linkPreview.jpegThumbnail));
});

test("no card when the text has no link, and no card on a file caption", () => {
  assert.deepEqual(buildBaileysContent("Tanpa tautan", { linkPreview: card }), { text: "Tanpa tautan" });
  const withBoth = buildBaileysContent("https://example.com/", { ...file("document", "application/pdf"), linkPreview: card }) as Record<string, unknown>;
  assert.equal("linkPreview" in withBoth, false);
});

test("plain text stays plain text", () => {
  assert.deepEqual(buildBaileysContent("Halo"), { text: "Halo" });
});

test("a text that fits a caption goes with the file in one message", () => {
  assert.equal(planBaileysMessages("Singkat", file("document", "application/pdf")).length, 1);
});

test("a text longer than a caption goes out right after the file, with its link card", () => {
  const long = `Berikut penjelasannya. ${"Kalimat yang berguna. ".repeat(60)} Lihat https://example.com/`;
  const [first, second] = planBaileysMessages(long, { ...file("document", "application/pdf", "Brosur.pdf"), linkPreview: card }) as Record<string, unknown>[];
  assert.ok(Buffer.isBuffer(first.document) && first.caption === "");
  assert.equal(second.text, long);
  assert.ok(second.linkPreview && (second.linkPreview as Record<string, unknown>).title === "Contoh");
});
