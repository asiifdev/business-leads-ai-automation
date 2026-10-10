import { test } from "node:test";
import assert from "node:assert/strict";
import { contactPageLinks, extractContacts, mergeContacts, phoneFromWaProfile } from "./contact-extract";

const SITE = "https://tokokamera.id/";

test("extracts own-domain email first and drops placeholders and image names", () => {
  const html = `<a href="mailto:halo@tokokamera.id">x</a> dev@agency.io logo@2x.png you@example.com noreply@tokokamera.id`;
  assert.deepEqual(extractContacts(html, SITE).emails, ["halo@tokokamera.id", "dev@agency.io"]);
});

test("drops form placeholders", () => {
  assert.deepEqual(extractContacts("email@perusahaan.com nama@gmail.com admin@tokokamera.id", SITE).emails, ["admin@tokokamera.id", "nama@gmail.com"].slice(0, 1));
});

test("reads obfuscated [at] addresses", () => {
  assert.deepEqual(extractContacts("kontak: info [at] tokokamera.id", SITE).emails, ["info@tokokamera.id"]);
});

test("finds WhatsApp numbers in wa.me and api links", () => {
  const html = `<a href="https://wa.me/6281234567890?text=hi">a</a><a href="https://api.whatsapp.com/send?phone=6281200001111&amp;text=x">b</a>`;
  assert.deepEqual(extractContacts(html, SITE).whatsapp, ["6281234567890", "6281200001111"]);
});

test("finds profiles and ignores share links", () => {
  const html = `<a href="https://www.facebook.com/sharer/sharer.php?u=1">s</a><a href="https://instagram.com/tokokamera.id/">i</a><a href="https://www.tiktok.com/@tokokamera">t</a><a href="https://twitter.com/intent/tweet">x</a><a href="https://instagram.com/p/abc">post</a>`;
  const s = extractContacts(html, SITE).social;
  assert.equal(s.instagram, "https://instagram.com/tokokamera.id");
  assert.equal(s.tiktok, "https://www.tiktok.com/@tokokamera");
  assert.equal(s.facebook, undefined);
  assert.equal(s.x, undefined);
});

test("returns nothing when the page has no contacts, and never invents any", () => {
  assert.deepEqual(extractContacts("<p>Selamat datang</p>", SITE), { emails: [], whatsapp: [], whatsappHandles: [], social: {} });
});

test("keeps wa.me usernames apart from numbers", () => {
  const c = extractContacts(`<a href="https://wa.me/asiifdev?text=Halo">a</a><a href="https://wa.me/6281234567890">b</a><a href="https://wa.me/message/ABC">c</a>`, SITE);
  assert.deepEqual(c.whatsappHandles, ["asiifdev"]);
  assert.deepEqual(c.whatsapp, ["6281234567890"]);
});

test("hostile input stays fast", () => {
  const t = Date.now();
  extractContacts("a".repeat(900_000) + "@" + "b.".repeat(100_000), SITE);
  extractContacts("https://wa.me/".repeat(50_000) + "x".repeat(500_000), SITE);
  assert.ok(Date.now() - t < 2000);
});

test("contactPageLinks keeps same-site contact pages only", () => {
  const html = `<a href="/kontak">k</a><a href="https://other.com/contact">o</a><a href="/tentang-kami">t</a><a href="/kontak/logo.png">i</a>`;
  assert.deepEqual(contactPageLinks(html, SITE), ["https://tokokamera.id/kontak", "https://tokokamera.id/tentang-kami"]);
});

test("mergeContacts dedupes and keeps first social link", () => {
  const m = mergeContacts([{ emails: ["a@x.id"], whatsapp: [], whatsappHandles: [], social: { instagram: "i1" } }, { emails: ["a@x.id", "b@x.id"], whatsapp: ["62811"], whatsappHandles: [], social: { instagram: "i2" } }]);
  assert.deepEqual(m, { emails: ["a@x.id", "b@x.id"], whatsapp: ["62811"], whatsappHandles: [], social: { instagram: "i1" } });
});

test("phoneFromWaProfile reads the number a wa.me profile page prints", () => {
  assert.equal(phoneFromWaProfile('<a href="https://api.whatsapp.com/send/?phone=6285954270458&text">x</a>'), "6285954270458");
  assert.equal(phoneFromWaProfile("<p>+62 859-5427-0458</p>"), "6285954270458");
  assert.equal(phoneFromWaProfile("<p>tidak ada nomor</p>"), null);
});

test("emails: window scan handles long runs and many @ signs quickly", () => {
  const t = Date.now();
  extractContacts("@".repeat(200_000) + "a".repeat(900_000), SITE);
  extractContacts(("x@y.z ".repeat(100_000)), SITE);
  assert.ok(Date.now() - t < 1500);
  assert.deepEqual(extractContacts("hubungi (halo@tokokamera.id), atau <b>info@tokokamera.id.</b>", SITE).emails, ["halo@tokokamera.id", "info@tokokamera.id"]);
});
