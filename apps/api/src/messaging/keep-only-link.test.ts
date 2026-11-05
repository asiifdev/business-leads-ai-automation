import test from "node:test";
import assert from "node:assert/strict";
import { keepOnlyLink } from "./message-writer.service";

test("the owner's link stays, any other address is removed", () => {
  assert.equal(keepOnlyLink("Lihat https://example.com/a. Atau https://evil.example.org/x ya", "https://example.com/a"), "Lihat https://example.com/a. Atau  ya");
  assert.equal(keepOnlyLink("Cek www.example.net sekarang", null), "Cek  sekarang");
  assert.equal(keepOnlyLink("Tanpa tautan sama sekali.", "https://example.com"), "Tanpa tautan sama sekali.");
});

test("a trailing slash or punctuation does not make the owner's link look different", () => {
  assert.equal(keepOnlyLink("Lihat https://example.com/, ya.", "https://example.com"), "Lihat https://example.com/, ya.");
});
