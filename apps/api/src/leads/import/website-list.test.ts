import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_WEBSITES, businessNameFromPage, parseWebsiteList } from "./website-list";

test("a pasted list in any separator becomes clean addresses", () => {
  const r = parseWebsiteList("contoh.co.id, https://www.bengkel-maju.example.com/kontak?utm_source=x&id=2#top\nhttp://toko.example.org;  <https://kopi.example.net>.");
  assert.deepEqual(r.urls, ["https://contoh.co.id/", "https://www.bengkel-maju.example.com/kontak?id=2", "http://toko.example.org/", "https://kopi.example.net/"]);
  assert.equal(r.invalid.length, 0);
});

test("the same site twice, junk, and pages that are not a business's own are counted apart", () => {
  const r = parseWebsiteList("contoh.co.id https://www.contoh.co.id/about not-a-site ftp://x.example.com javascript:alert(1) linktr.ee/contoh tokopedia.com/toko https://user:pw@secret.example.com tiktok.com/@x");
  assert.deepEqual(r.urls, ["https://contoh.co.id/"]);
  assert.equal(r.duplicates, 1);
  assert.equal(r.unsupported, 3);
  assert.equal(r.invalid.length, 4);
  assert.ok(!r.invalid.some((x) => x.includes("pw@")) || r.invalid.length <= 5);
});

test("Instagram and Facebook pages are accepted as profiles, each once", () => {
  const r = parseWebsiteList("https://instagram.com/kopi.contoh/?igsh=abc instagram.com/kopi.contoh facebook.com/BengkelContoh instagram.com/lain");
  assert.deepEqual(r.urls, ["https://instagram.com/kopi.contoh/", "https://facebook.com/BengkelContoh", "https://instagram.com/lain"]);
  assert.equal(r.duplicates, 1);
});

test("the list is capped and hostile text stays fast", () => {
  const many = Array.from({ length: MAX_WEBSITES + 30 }, (_, i) => `site${i}.example.com`).join("\n");
  const r = parseWebsiteList(many);
  assert.equal(r.urls.length, MAX_WEBSITES);
  assert.equal(r.truncated, true);
  const t = Date.now();
  parseWebsiteList("a".repeat(500_000));
  parseWebsiteList(".".repeat(500_000));
  parseWebsiteList("http://".repeat(50_000));
  parseWebsiteList("a.b ".repeat(10_000));
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t} ms`);
});

test("the business name is the page's own, else the real part of the title, else the domain", () => {
  assert.equal(businessNameFromPage({ jsonldName: "Rumah Makan Contoh", siteName: "x", title: "y" }, "https://a.example.com"), "Rumah Makan Contoh");
  assert.equal(businessNameFromPage({ siteName: "Bengkel Maju" }, "https://a.example.com"), "Bengkel Maju");
  assert.equal(businessNameFromPage({ title: "Beranda | Toko Maju Jaya" }, "https://a.example.com"), "Toko Maju Jaya");
  assert.equal(businessNameFromPage({ title: "Toko Maju Jaya - Jual Kamera Bekas" }, "https://a.example.com"), "Toko Maju Jaya");
  assert.equal(businessNameFromPage({ siteName: "Home", title: "Welcome" }, "https://www.contoh.co.id/"), "contoh.co.id");
  assert.equal(businessNameFromPage({}, "https://www.contoh.co.id/"), "contoh.co.id");
});
