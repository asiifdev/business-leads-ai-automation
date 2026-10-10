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
