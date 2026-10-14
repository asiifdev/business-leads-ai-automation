import test from "node:test";
import assert from "node:assert/strict";
import { analyzeConversation, type ConversationMessage } from "./thread";

const min = (n: number) => n * 60_000;
const out = (at: number, text: string): ConversationMessage => ({ mine: true, at, text });
const them = (at: number, text: string, auto = false): ConversationMessage => ({ mine: false, at, text, auto });

test("the owner wrote after their last reply: it is answered", () => {
  const c = analyzeConversation([out(0, "Boleh saya kirim contoh?"), them(min(5), "Boleh"), out(min(8), "Baik kak, ini contohnya")]);
  assert.equal(c.answered, true);
});

test("their reply is the last word: it is not answered", () => {
  const c = analyzeConversation([out(0, "Boleh saya kirim contoh?"), them(min(5), "Boleh")]);
  assert.equal(c.answered, false);
  assert.equal(c.incoming, "Boleh");
});

test("a shop's automatic greeting is not a person's reply, so it never makes a thread 'waiting for an answer'", () => {
  const c = analyzeConversation([out(0, "Halo"), them(min(0.2), "Terima kasih telah menghubungi kami", true)]);
  assert.equal(c.newestReply, null);
  assert.equal(c.answered, false);
});

test("the owner's message sent from the phone counts, and a later reply reopens the thread", () => {
  const c = analyzeConversation([out(0, "Halo"), them(min(5), "Berapa?"), out(min(6), "[Dokumen: Brosur.pdf]"), them(min(30), "Mahal", false)]);
  assert.equal(c.answered, false);
  assert.equal(c.incoming, "Mahal");
  assert.match(c.history, /Saya: \[Dokumen: Brosur.pdf\]/);
});

test("no messages at all is not answered and has no reply", () => {
  const c = analyzeConversation([]);
  assert.equal(c.newestReply, null);
  assert.equal(c.answered, false);
});

test("what their last words were is known even when the owner answered after them", () => {
  const c = analyzeConversation([out(0, "Boleh saya kirim contoh?"), them(min(5), "Boleh kak"), them(min(5) + 20_000, "sekalian harganya"), out(min(9), "Siap, ini contohnya")]);
  assert.equal(c.answered, true);
  assert.equal(c.incoming, "");
  assert.equal(c.theirLast, "Boleh kak\nsekalian harganya");
});

test("an older message of theirs, answered in between, is not part of their last words", () => {
  const c = analyzeConversation([them(0, "Berapa harganya?"), out(min(1), "Rp 100.000"), them(min(30), "Oke saya pikir dulu")]);
  assert.equal(c.theirLast, "Oke saya pikir dulu");
  const none = analyzeConversation([out(0, "Halo")]);
  assert.equal(none.theirLast, "");
});

import { peakOfConversation } from "./stage-peak";

test("the stage a conversation honestly reached: a later 'Ok' does not undo a meeting, and 'Boleh' to an example is not one", () => {
  const demo = peakOfConversation([out(0, "Mau saya tunjukkan demo singkatnya?"), them(min(5), "boleh kak"), out(min(10), "Besok jam 10 ya"), them(min(20), "Ok")]);
  assert.equal(demo.stage, "meeting");
  const example = peakOfConversation([out(0, "Jadwal unit terlihat jelas. Boleh saya kirim contoh tampilannya?"), them(min(5), "Boleh")]);
  assert.equal(example.stage, "interested");
  const plain = peakOfConversation([out(0, "Halo"), them(min(5), "Berapa harganya?")]);
  assert.equal(plain.stage, "replied");
});

test("only a shop's automatic messages, or nothing at all, reached no stage", () => {
  assert.equal(peakOfConversation([out(0, "Halo"), them(min(1), "Terima kasih telah menghubungi kami", true)]).stage, null);
  assert.equal(peakOfConversation([]).stage, null);
});
