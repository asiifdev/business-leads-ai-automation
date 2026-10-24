import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichTarget, readDue } from "./enrich-target";

test("a real website is read as a website", () => {
  assert.deepEqual(enrichTarget({ website: "https://contoh.example.com" }), { kind: "website", url: "https://contoh.example.com" });
  assert.deepEqual(enrichTarget({ website: "https://contoh.example.com", enrichment: { social: { instagram: "https://instagram.com/x" } } })?.kind, "website");
});

test("a profile page given as the website is read as a profile", () => {
  assert.deepEqual(enrichTarget({ website: "https://www.instagram.com/contoh/" }), { kind: "profile", url: "https://www.instagram.com/contoh/", platform: "instagram" });
  assert.deepEqual(enrichTarget({ website: "facebook.com/contoh" }), { kind: "profile", url: "https://facebook.com/contoh", platform: "facebook" });
});

test("without a website, a profile found earlier is used, Instagram first", () => {
  const enrichment = { social: { facebook: "https://facebook.com/c", instagram: "https://instagram.com/c", tiktok: "https://tiktok.com/@c" } };
  assert.deepEqual(enrichTarget({ website: "", enrichment }), { kind: "profile", url: "https://instagram.com/c", platform: "instagram" });
  assert.equal(enrichTarget({ website: null, enrichment: { social: { tiktok: "https://tiktok.com/@c" } } }), null);
});

test("nothing to read: no website, no profile, a link page, or junk stored data", () => {
  assert.equal(enrichTarget({ website: "" }), null);
  assert.equal(enrichTarget({ website: "https://linktr.ee/contoh" }), null);
  assert.equal(enrichTarget({ website: null, enrichment: "junk" }), null);
  assert.equal(enrichTarget({ website: null, enrichment: { social: { instagram: "https://evil.example.com/x" } } }), null);
});

test("reading is due when never done or old, and only when there is something to read", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  const site = "https://contoh.example.com";
  assert.equal(readDue({ website: site, enrichedAt: null }, now), true);
  assert.equal(readDue({ website: site, enrichedAt: new Date("2026-10-01T00:00:00Z") }, now), false);
  assert.equal(readDue({ website: site, enrichedAt: new Date("2026-01-01T00:00:00Z") }, now), true);
  assert.equal(readDue({ website: "", enrichedAt: null }, now), false);
});
