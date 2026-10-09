import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chunkText } from "./text-chunker";

test("empty input gives no chunks", () => assert.deepEqual(chunkText("  \n "), []));

test("short text stays one chunk", () => assert.deepEqual(chunkText("Harga paket Pro Rp250.000 per bulan."), ["Harga paket Pro Rp250.000 per bulan."]));

test("long text is split and no chunk is far over the limit", () => {
  const long = Array.from({ length: 60 }, (_, i) => `Kalimat nomor ${i} menjelaskan satu hal tentang layanan kami.`).join(" ");
  const chunks = chunkText(long, { maxChars: 300, overlap: 40 });
  assert.ok(chunks.length > 3);
  for (const c of chunks) assert.ok(c.length <= 300 + 41, `chunk too long: ${c.length}`);
});

test("a single oversized word run is hard-split", () => {
  const chunks = chunkText("x".repeat(2500), { maxChars: 1000, overlap: 0 });
  assert.equal(chunks.length, 3);
});

test("overlap repeats the tail of the previous chunk", () => {
  const chunks = chunkText(["A".repeat(250), "B".repeat(250)].join("\n\n"), { maxChars: 260, overlap: 20 });
  assert.equal(chunks.length, 2);
  assert.ok(chunks[1].startsWith("A".repeat(20)));
});
