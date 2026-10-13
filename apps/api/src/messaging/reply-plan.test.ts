import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReply, planReplyAction, templateReply } from "./reply-plan";

test("planReplyAction picks the action in code", () => {
  assert.equal(planReplyAction("auto_reply", "Terimakasih telah menghubungi"), "none");
  assert.equal(planReplyAction("other", "Hallo kak, untuk itu akan kami info keatasan kami terlebih dahulu ya kak, terimakasih"), "thanks_wait");
  assert.equal(planReplyAction("price", "Berapa harganya?"), "answer");
  assert.equal(planReplyAction("interested", "Tertarik, kirim infonya"), "next_step");
  assert.equal(planReplyAction("not_interested", "Kami sudah punya"), "thanks_close");
  assert.equal(planReplyAction("not_now", "Bulan depan ya"), "thanks_later");
  assert.equal(planReplyAction("other", "ok"), "thanks_wait");
});

test("templates are polite and have no emoji or commands", () => {
  for (const a of ["thanks_close", "thanks_wait", "thanks_later"] as const) {
    const t = templateReply(a, "indonesian")!;
    assert.deepEqual(checkReply(t, { alreadyIntroduced: true, knownText: "" }), []);
  }
  assert.equal(templateReply("answer", "indonesian"), null);
});

test("checkReply catches the failures seen in real drafts", () => {
  const ctx = { alreadyIntroduced: true, knownText: "" };
  assert.ok(checkReply("Siapp, Kak. Kabari saja ya kalau sudah.", ctx).includes("commanding tone"));
  assert.ok(checkReply("Baik, Kak. Saya dari invly.id, kami bantu software sewa dan rental.", ctx).includes("introduces itself again"));
  assert.ok(checkReply("Baik, Kak 😁 terima kasih banyak", ctx).includes("emoji"));
  assert.ok(checkReply("Silakan lihat https://contoh.com/x ya", ctx).includes("unknown link"));
  assert.deepEqual(checkReply("Baik, Kak. Harganya mulai Rp199.000 per bulan, dan ada coba gratis 14 hari.", ctx), []);
});
