import test from "node:test";
import assert from "node:assert/strict";
import { isOptOut } from "./opt-out";

test("STOP inside a short sentence is an opt-out, the way people answer our own 'balas STOP' line", () => {
  for (const t of ["Maaf kak belum ya STOP", "Ok stop", "belum butuh, stop ya kak", "tolong berhenti ya", "jangan ganggu lagi", "unsubscribe", "STOP", "stop!!"]) assert.equal(isOptOut(t), true, t);
});

test("a long message, a question about something else, or an unrelated word is not an opt-out", () => {
  assert.equal(isOptOut("Halo kak, kami lagi sibuk jadi nanti dikabari lagi ya. Untuk saat ini kami sedang meninjau beberapa penawaran sistem sewa lain dan belum bisa memutuskan, terima kasih banyak"), false);
  assert.equal(isOptOut("Berapa harganya kak?"), false);
  assert.equal(isOptOut("stopwatch"), false);
  assert.equal(isOptOut("Sewa motor dekat bus stop terminal ada?"), false);
});
