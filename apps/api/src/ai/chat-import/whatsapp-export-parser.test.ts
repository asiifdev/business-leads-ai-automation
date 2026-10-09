import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseWhatsAppExport } from "./whatsapp-export-parser";

const ANDROID_ID = `21/07/26 16.49 - Pesan dan telepon terenkripsi end-to-end.
21/07/26 16.50 - \u200eBudi: Halo kak, ready kebaya kutubaru?
22/07/26 09.01 - Sari: Ready kak 🙏
Mau tanggal berapa?
Nanti saya cek dulu ya
22/07/26 09.02 - Budi: <Media tidak disertakan>
22/07/26 09.03 - Sari: Pesan ini dihapus
23/07/26 10.00 - Sari: IMG-20260723-WA0001.jpg (file terlampir)`;

test("Android Indonesian layout, multi-line, media, deleted", () => {
  const r = parseWhatsAppExport(ANDROID_ID);
  assert.deepEqual(r.senders, ["Budi", "Sari"]);
  assert.equal(r.systemLines, 1);
  assert.equal(r.messages.length, 4); // deleted message dropped
  assert.equal(r.messages[1].text, "Ready kak 🙏\nMau tanggal berapa?\nNanti saya cek dulu ya");
  assert.equal(r.messages[2].isMedia, true);
  assert.equal(r.messages[3].isMedia, true);
  assert.equal(r.dateOrder, "dmy");
  assert.equal(r.messages[0].at.toISOString(), "2026-07-21T16:50:00.000Z");
});

test("iOS layout with seconds", () => {
  const r = parseWhatsAppExport("[21/07/2026, 16.49.12] Budi: Halo\n[21/07/2026, 16.50.00] Sari: Hai");
  assert.equal(r.messages.length, 2);
  assert.equal(r.messages[1].sender, "Sari");
});

test("US layout with AM/PM is detected as month-first", () => {
  const r = parseWhatsAppExport("7/21/26, 4:49 PM - Budi: Hi\n7/22/26, 12:05 AM - Sari: Hello");
  assert.equal(r.dateOrder, "mdy");
  assert.equal(r.messages[0].at.toISOString(), "2026-07-21T16:49:00.000Z");
  assert.equal(r.messages[1].at.toISOString(), "2026-07-22T00:05:00.000Z");
});

test("system lines do not swallow the next text and colons in text are kept", () => {
  const r = parseWhatsAppExport("01/02/26 10.00 - Budi mengubah subjek grup\n01/02/26 10.01 - Budi: Jam 10:30 ya");
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].text, "Jam 10:30 ya");
});

test("garbage before the first header is counted, not crashed on", () => {
  const r = parseWhatsAppExport("random\n01/02/26 10.01 - Budi: ok");
  assert.equal(r.skippedLines, 1);
  assert.equal(r.messages.length, 1);
});

test("bare media file names are media placeholders", () => {
  const r = parseWhatsAppExport("01/02/26 10.00 - Budi: IMG-20260201-WA0003.jpg\n01/02/26 10.01 - Budi: PTT-20260201-WA0001.opus");
  assert.equal(r.messages.every((m) => m.isMedia), true);
});
