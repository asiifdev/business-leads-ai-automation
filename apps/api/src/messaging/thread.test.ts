import test from "node:test";
import assert from "node:assert/strict";
import { buildThread, type ThreadLine } from "./thread";

const min = (n: number) => n * 60_000;
const out = (at: number, text: string): ThreadLine => ({ mine: true, at, text });
const them = (at: number, text: string): ThreadLine => ({ mine: false, at, text });

test("an answer written 25 minutes after a canned greeting is not mixed with it", () => {
  const t = buildThread([out(0, "Boleh saya kirim contohnya, Kak?"), them(min(0.1), "HALLO KAK. Isi formulir di bawah ini. Tidak diisi, tidak kami respon"), them(min(25), "Boleh")], "Boleh");
  assert.equal(t.incoming, "Boleh");
  assert.match(t.history, /Saya: Boleh saya kirim contohnya/);
  assert.match(t.history, /Mereka: HALLO KAK/);
});

test("quick bubbles written together are answered together", () => {
  const t = buildThread([out(0, "Boleh saya kirim contohnya?"), them(min(10), "boleh"), them(min(10) + 15_000, "sekalian harganya"), them(min(10) + 30_000, "ya kak")], "ya kak");
  assert.equal(t.incoming, "boleh\nsekalian harganya\nya kak");
  assert.equal(t.history, "Saya: Boleh saya kirim contohnya?");
});

test("an earlier bubble more than a few minutes before the next is history", () => {
  const t = buildThread([out(0, "Halo"), them(min(1), "tunggu ya"), them(min(30), "oke boleh")], "oke boleh");
  assert.equal(t.incoming, "oke boleh");
  assert.match(t.history, /Mereka: tunggu ya/);
});

test("one very long bubble cannot swamp the prompt", () => {
  const t = buildThread([out(0, "Halo"), them(min(5), "x".repeat(5000))], "x");
  assert.ok(t.incoming.length <= 500);
});

test("with no bubbles from them, the latest text is used", () => {
  assert.equal(buildThread([out(0, "Halo")], "Boleh").incoming, "Boleh");
});
