import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText, isBlockedAddress, validatePublicUrl } from "./url-fetch";

test("blocks private, loopback, link-local and metadata addresses", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.1.2.3"]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "193.0.0.1", "2606:4700:4700::1111"]) assert.equal(isBlockedAddress(ip), false, ip);
});

test("rejects unsafe URLs before any network call", () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com", "http://localhost/admin", "http://127.0.0.1:3001/api", "http://169.254.169.254/latest/meta-data", "http://user:pw@example.com", "https://example.com:8443/x", "http://printer.local/", "http://[::1]/", "not a url"]) {
    assert.throws(() => validatePublicUrl(u), undefined, u);
  }
  assert.equal(validatePublicUrl(" https://asiifdev.com/layanan ").hostname, "asiifdev.com");
});

test("htmlToText keeps headings, paragraphs and lists, drops scripts, menus and repeats", () => {
  const html = `<html><head><title>Asiifdev &amp; Co</title><meta name="description" content="AI agent untuk bisnis"><style>.x{}</style></head>
  <body><nav><a>Home</a><a>Harga</a></nav><script>alert(1)</script>
  <h1>AI agent untuk UMKM</h1><p>Kami membangun asisten WhatsApp.<br>Sudah berjalan di produksi.</p>
  <ul><li>Balas pelanggan</li><li>Catat pesanan</li></ul><footer>hak cipta</footer></body></html>`;
  const { title, text } = htmlToText(html);
  assert.equal(title, "Asiifdev & Co");
  assert.match(text, /^# Asiifdev & Co\n\nAI agent untuk bisnis\n\n/);
  assert.match(text, /## AI agent untuk UMKM/);
  assert.match(text, /Kami membangun asisten WhatsApp\.\nSudah berjalan di produksi\./);
  assert.match(text, /- Balas pelanggan\n- Catat pesanan/);
  assert.doesNotMatch(text, /alert|Home|hak cipta|\.x\{/);
});

test("htmlToText stays linear on hostile input", () => {
  const cases = [
    "<script".repeat(200_000),
    "<div>".repeat(300_000),
    "<!--".repeat(200_000),
    "<p>a</p>".repeat(250_000),
    "<" .repeat(500_000),
    "<a ".repeat(500_000),
    "<p".repeat(700_000),
    "<style>" + "x".repeat(1_900_000),
  ];
  for (const html of cases) {
    const t0 = Date.now();
    const { text } = htmlToText(html);
    assert.ok(Date.now() - t0 < 1500, `took ${Date.now() - t0} ms`);
    assert.ok(text.length <= 60_000);
  }
});

test("htmlToText treats a bare < as text and skips unclosed script content", () => {
  assert.match(htmlToText("<p>5 < 6 dan 7 > 3</p>").text, /5 < 6 dan 7 > 3/);
  assert.doesNotMatch(htmlToText("<p>aman</p><script>jahat()").text, /jahat/);
});

test("isBlockedAddress covers IPv6 forms that embed an IPv4 address", () => {
  const blocked = [
    "::1", "::", "::ffff:127.0.0.1", "::ffff:7f00:1", "::127.0.0.1", "::7f00:1", "::a00:1",
    "64:ff9b::7f00:1", "64:ff9b::10.0.0.5", "64:ff9b:1::1", "2002:7f00:1::", "2002:a9fe:a9fe::1", "2001::1", "2001:db8::1",
    "fc00::1", "fd12::1", "fe80::1", "fec0::1", "ff02::1", "100::1",
    "169.254.169.254", "100.64.0.1", "192.0.2.1", "198.51.100.7", "203.0.113.9", "0.0.0.0", "255.255.255.255",
  ];
  for (const ip of blocked) assert.equal(isBlockedAddress(ip), true, ip);
  const open = ["8.8.8.8", "1.1.1.1", "2606:4700::1111", "2001:4860:4860::8888", "64:ff9b::808:808", "2002:808:808::1", "::ffff:8.8.8.8"];
  for (const ip of open) assert.equal(isBlockedAddress(ip), false, ip);
});
