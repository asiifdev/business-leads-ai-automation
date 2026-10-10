import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCandidate, parseLlmsLinks, parseSitemapXml, robotsSitemaps, scoreUrl, selectPages } from "./site-crawler";

const base = new URL("https://asiifdev.com/");

test("normalizeCandidate keeps same-site pages and drops assets, other hosts and noise", () => {
  assert.equal(normalizeCandidate("/layanan/", base), "https://asiifdev.com/layanan");
  assert.equal(normalizeCandidate("https://www.asiifdev.com/tentang?utm=1#x", base), "https://asiifdev.com/tentang");
  assert.equal(normalizeCandidate("https://other.com/x", base), null);
  assert.equal(normalizeCandidate("/logo.png", base), null);
  assert.equal(normalizeCandidate("/wp-admin/x", base), null);
  assert.equal(normalizeCandidate("/blog/tag/ai", base), null);
  assert.equal(normalizeCandidate("mailto:a@b.c", base), null);
});

test("parseSitemapXml reads urlsets and sitemap indexes", () => {
  assert.deepEqual(parseSitemapXml("<urlset><url><loc>https://a.com/x</loc></url><url><loc> https://a.com/y?a=1&amp;b=2 </loc></url></urlset>").urls, ["https://a.com/x", "https://a.com/y?a=1&b=2"]);
  const idx = parseSitemapXml("<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>");
  assert.equal(idx.isIndex, true);
  assert.deepEqual(idx.sitemaps, ["https://a.com/s1.xml"]);
});

test("parseLlmsLinks takes markdown and bare links from the same site", () => {
  const txt = "# Asiifdev\n> AI agent\n- [Layanan](/layanan): jasa\n- [Harga](https://asiifdev.com/harga)\nLihat juga https://asiifdev.com/tentang. Luar: https://x.com/y";
  assert.deepEqual(parseLlmsLinks(txt, base).sort(), ["https://asiifdev.com/harga", "https://asiifdev.com/layanan", "https://asiifdev.com/tentang"]);
});

test("robotsSitemaps", () => assert.deepEqual(robotsSitemaps("User-agent: *\nSitemap: https://a.com/sitemap.xml\nsitemap: https://a.com/b.xml"), ["https://a.com/sitemap.xml", "https://a.com/b.xml"]));

test("ranking puts the home page first, then business pages, and limits blog posts", () => {
  const start = "https://asiifdev.com";
  const urls = [start, "https://asiifdev.com/layanan", "https://asiifdev.com/harga", "https://asiifdev.com/tentang", "https://asiifdev.com/kontak", "https://asiifdev.com/blog/a", "https://asiifdev.com/blog/b", "https://asiifdev.com/blog/c", "https://asiifdev.com/misc/deep/page/one"];
  assert.ok(scoreUrl(start, start) > scoreUrl("https://asiifdev.com/layanan", start));
  const picked = selectPages(urls, start, 8);
  assert.equal(picked[0], start);
  assert.ok(["layanan", "harga", "tentang"].every((p) => picked.includes(`https://asiifdev.com/${p}`)));
  assert.equal(picked.filter((u) => u.includes("/blog/")).length, 2);
  assert.equal(selectPages(urls, start, 3).length, 3);
});
