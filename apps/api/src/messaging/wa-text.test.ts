import test from "node:test";
import assert from "node:assert/strict";
import { messageText } from "./wa-text";

test("plain and extended text are read", () => {
  assert.equal(messageText({ conversation: " Boleh " }), "Boleh");
  assert.equal(messageText({ extendedTextMessage: { text: "Berapa kak?" } }), "Berapa kak?");
});

test("a photo or document caption is a reply (a photo of a price list)", () => {
  assert.equal(messageText({ imageMessage: { caption: "Daftar harga kami segini" } }), "Daftar harga kami segini");
  assert.equal(messageText({ documentMessage: { caption: "Ini brosurnya", fileName: "b.pdf" } }), "Ini brosurnya");
});

test("a picture or file with no words is not a reply, but the owner's own one is marked", () => {
  assert.equal(messageText({ imageMessage: {} }), "");
  assert.equal(messageText({ documentMessage: { fileName: "Sewa Kendaraan Fitur Sistem.pdf" } }), "");
  assert.equal(messageText({ documentMessage: { fileName: "Sewa Kendaraan Fitur Sistem.pdf" } }, { markers: true }), "[Dokumen: Sewa Kendaraan Fitur Sistem.pdf]");
  assert.equal(messageText({ imageMessage: { caption: "Foto motor" } }, { markers: true }), "[Gambar] Foto motor");
  assert.equal(messageText({ audioMessage: {} }, { markers: true }), "[Pesan suara]");
});

test("wrapped messages (disappearing, view once, document with caption) are unwrapped", () => {
  assert.equal(messageText({ ephemeralMessage: { message: { conversation: "Halo" } } }), "Halo");
  assert.equal(messageText({ viewOnceMessageV2: { message: { imageMessage: { caption: "Sekali lihat" } } } }), "Sekali lihat");
  assert.equal(messageText({ documentWithCaptionMessage: { message: { documentMessage: { caption: "Lampiran", fileName: "x.pdf" } } } }), "Lampiran");
});

test("nothing readable gives an empty string", () => {
  assert.equal(messageText(null), "");
  assert.equal(messageText({}), "");
  assert.equal(messageText({ stickerMessage: {} }), "");
});

import { vcardPhones } from "./wa-text";

const VCARD = "BEGIN:VCARD\nVERSION:3.0\nFN:Contoh Nama\nTEL;type=CELL;type=VOICE;waid=6281200000001:+62 812-0000-0001\nEND:VCARD";

test("a shared contact card is read with its name and WhatsApp number, for replies and for the owner's own messages", () => {
  assert.deepEqual(vcardPhones(VCARD), ["+6281200000001"]);
  const card = { contactMessage: { displayName: "Contoh Nama", vcard: VCARD } };
  assert.equal(messageText(card), "[Kontak: Contoh Nama +6281200000001]");
  assert.equal(messageText(card, { markers: true }), "[Kontak: Contoh Nama +6281200000001]");
});

test("several contacts, a number without waid, and junk in the vCard", () => {
  const many = { contactsArrayMessage: { contacts: [{ displayName: "A", vcard: "TEL:0812 0000 0002" }, { displayName: "B", vcard: "TEL:12" }] } };
  assert.equal(messageText(many), "[Kontak: A 081200000002] [Kontak: B]");
  assert.deepEqual(vcardPhones("not a vcard"), []);
  assert.deepEqual(vcardPhones(null), []);
});

import { parseReferrals } from "./wa-text";

test("a shared card and a number written in the text are both found, once each", () => {
  const r = parseReferrals("[Kontak: Contoh Nama +6281200000001] halo hubungi juga 0812-0000-0002 atau +62 812 0000 0001");
  assert.deepEqual(r, [{ name: "Contoh Nama", phone: "+6281200000001" }, { name: null, phone: "0812-0000-0002" }]);
});

test("text without a contact gives nothing, and a card without a name is kept", () => {
  assert.deepEqual(parseReferrals("silakan hubungi management kami"), []);
  assert.deepEqual(parseReferrals("[Kontak: tanpa nama +6281200000003]"), [{ name: null, phone: "+6281200000003" }]);
  assert.deepEqual(parseReferrals("tahun 2026 jumlah 12345678"), []);
});
