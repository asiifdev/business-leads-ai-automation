import test from "node:test";
import assert from "node:assert/strict";
import { firstUrl, parseLinkPreview } from "./link-preview";

const page = `<!doctype html><html><head><title>Fallback &amp; Co</title>
<meta property="og:title" content="Contoh &#8211; Jasa Aplikasi &amp; AI">
<meta property='og:description' content='Pembuatan aplikasi, AI automation, IT outsourcing.'>
<meta property="og:image" content="/img/og.png">
<meta name="description" content="not used because og is present"></head><body></body></html>`;

test("title, description and picture come from Open Graph, with entities decoded", () => {
  const r = parseLinkPreview(page, "https://example.com/");
  assert.equal(r.title, "Contoh – Jasa Aplikasi & AI");
  assert.equal(r.description, "Pembuatan aplikasi, AI automation, IT outsourcing.");
  assert.equal(r.image, "https://example.com/img/og.png");
});

test("without Open Graph it falls back to <title> and the description meta", () => {
  const r = parseLinkPreview(`<title> Halo   dunia </title><meta name="description" content="Deskripsi biasa">`, "https://x.id/");
  assert.deepEqual(r, { title: "Halo dunia", description: "Deskripsi biasa", image: null });
});

test("a page with nothing usable gives empty fields instead of failing", () => {
  assert.deepEqual(parseLinkPreview("<html><body>hi</body></html>", "https://x.id/"), { title: "", description: "", image: null });
});

test("hostile pages are read in linear time", () => {
  const cases = [
    "<meta ".repeat(200_000),
    `<meta property="og:title" content="${"a".repeat(2_000_000)}`,
    "<title>".repeat(100_000),
    `<meta ${'x="'.repeat(100_000)}`,
    "<meta property=og:title content=".repeat(50_000),
  ];
  for (const html of cases) {
    const t = Date.now();
    parseLinkPreview(html, "https://x.id/");
    assert.ok(Date.now() - t < 500, `took ${Date.now() - t} ms`);
  }
});

test("a javascript: or data: picture is not turned into a fetchable address", () => {
  for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "file:///etc/passwd"]) {
    assert.equal(parseLinkPreview(`<meta property="og:title" content="t"><meta property="og:image" content="${bad}">`, "https://x.id/").image, null, bad);
  }
});

test("firstUrl finds the first address and drops trailing punctuation", () => {
  assert.equal(firstUrl("Lihat https://example.com/portfolio, ya."), "https://example.com/portfolio");
  assert.equal(firstUrl("tanpa tautan"), null);
});

import { maybePreview } from "./link-preview";

const card = { url: "https://example.com/", title: "Contoh", description: "d" };
const ok = async () => card;
const fails = async () => { throw new Error("unreachable"); };

test("a message with a link gets a card automatically, and one without does not", async () => {
  assert.deepEqual(await maybePreview("Lihat https://example.com", undefined, false, ok), card);
  assert.equal(await maybePreview("Tanpa tautan", undefined, false, ok), null);
});

test("automatic mode never blocks a message whose page cannot be read, but an explicit request reports it", async () => {
  assert.equal(await maybePreview("Lihat https://x.id", undefined, false, fails), null);
  await assert.rejects(maybePreview("Lihat https://x.id", true, false, fails), /unreachable/);
  await assert.rejects(maybePreview("Tanpa tautan", true, false, ok), /link/i);
});

test("turned off, or with a file attached, there is no card", async () => {
  assert.equal(await maybePreview("Lihat https://example.com", false, false, ok), null);
  assert.equal(await maybePreview("Lihat https://example.com", undefined, true, ok), null);
});
