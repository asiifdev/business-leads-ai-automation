import test from "node:test";
import assert from "node:assert/strict";
import { toWhatsapp } from "./whatsapp-format";

test("Markdown becomes WhatsApp syntax", () => {
  assert.equal(toWhatsapp("Kami **Contoh**."), "Kami *Contoh*.");
  assert.equal(toWhatsapp("## Layanan\n* web\n• aplikasi"), "*Layanan*\n\n- web\n- aplikasi");
  assert.equal(toWhatsapp("Ini ~~lama~~ baru dan __miring__."), "Ini ~lama~ baru dan _miring_.");
});

test("valid WhatsApp spans are kept as written", () => {
  assert.equal(toWhatsapp("Saya dari *Contoh Digital Agency*, _terbuka_ untuk konsultasi."), "Saya dari *Contoh Digital Agency*, _terbuka_ untuk konsultasi.");
});

test("unbalanced or spaced symbols are removed instead of shown", () => {
  assert.equal(toWhatsapp("Halo * Kak, ini *penting"), "Halo Kak, ini penting");
  assert.equal(toWhatsapp("kata * bold * di sini"), "kata bold di sini");
  assert.equal(toWhatsapp("file_name dan snake_case ok"), "file_name dan snake_case ok");
});

test("emphasis stays sparing", () => {
  const many = "*a1* *b2* *c3* *d4* *e5* *f6*";
  assert.equal((toWhatsapp(many).match(/\*/g) ?? []).length, 8);
  const long = `*${"kalimat panjang ".repeat(6).trim()}*`;
  assert.doesNotMatch(toWhatsapp(long), /\*/);
});

test("paragraphs and lists are spaced for a phone screen", () => {
  assert.equal(toWhatsapp("Halo, Kak.\nSaya dari X:\n- web\n- aplikasi\nTerima kasih."), "Halo, Kak.\nSaya dari X:\n\n- web\n- aplikasi\n\nTerima kasih.");
  assert.equal(toWhatsapp("a\n\n\n\nb"), "a\n\nb");
});

test("one unbroken block is split into greeting, body and closing", () => {
  const block = "Halo, Kak. Saya dari X. Kami membuat aplikasi dan website. Kami juga menerima IT outsourcing. Terima kasih.";
  assert.equal(toWhatsapp(block), "Halo, Kak.\n\nSaya dari X. Kami membuat aplikasi dan website. Kami juga menerima IT outsourcing.\n\nTerima kasih.");
  assert.equal(toWhatsapp("Halo, Kak. Terima kasih."), "Halo, Kak. Terima kasih.");
});

import { tidyWhatsappOutreach } from "./plain-text";

test("the first message greets with Kak and never says Bapak/Ibu", () => {
  assert.equal(tidyWhatsappOutreach("Halo,\n\nPerkenalkan saya dari X."), "Halo, Kak.\n\nPerkenalkan saya dari X.");
  assert.equal(tidyWhatsappOutreach("Halo, Kak. Jika Bapak/Ibu berkenan, kami siap."), "Halo, Kak. Jika Kakak berkenan, kami siap.");
  assert.equal(tidyWhatsappOutreach("Halo Perkenalkan saya dari X."), "Halo, Kak. Perkenalkan saya dari X.");
  assert.equal(tidyWhatsappOutreach("Halo, Kak. Saya dari X."), "Halo, Kak. Saya dari X.");
  assert.equal(tidyWhatsappOutreach("Halo Bapak/Ibu,\n\nSaya dari X."), "Halo, Kak.\n\nSaya dari X.");
  assert.equal(tidyWhatsappOutreach("Hai Kakak, saya dari X."), "Halo, Kak. saya dari X.");
  assert.equal(tidyWhatsappOutreach("Pak Budi, selamat siang."), "Pak Budi, selamat siang.");
  assert.equal(tidyWhatsappOutreach("Halo, Kak. Apakah Anda ingin berdiskusi tentang bisnis Anda?"), "Halo, Kak. Apakah Kakak ingin berdiskusi tentang bisnis Kakak?");
});
