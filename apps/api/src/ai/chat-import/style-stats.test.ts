import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildReplyPairs, computeStyleStats } from "./style-stats";
import type { ParsedMessage } from "./whatsapp-export-parser";

const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 10, min));
const msg = (sender: string, text: string, min: number, isMedia = false): ParsedMessage => ({ sender, text, at: t(min), isMedia });

const chat: ParsedMessage[] = [
  msg("Cust", "Kak ready kebaya?", 0),
  msg("Me", "Ready kak 🙏", 1),
  msg("Me", "Untuk tanggal berapa?", 2),
  msg("Cust", "Tanggal 12", 3),
  msg("Cust", "Bisa DP berapa?", 4),
  msg("Me", "DP 50% ya kak!", 5),
  msg("Me", "foto.jpg (file terlampir)", 6, true),
];

test("style stats count only my non-media messages", () => {
  const s = computeStyleStats(chat, "Me");
  assert.equal(s.messageCount, 3);
  assert.equal(s.emojiRate, 0.333);
  assert.equal(s.exclamationRate, 0.333);
  assert.equal(s.questionRate, 0.333);
  assert.equal(s.topEmoji[0].emoji, "🙏");
  assert.ok(s.language.indonesian > s.language.english);
});

test("reply pairs join consecutive messages on each side", () => {
  const pairs = buildReplyPairs(chat, "Me");
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].incoming, "Kak ready kebaya?");
  assert.equal(pairs[0].reply, "Ready kak 🙏\nUntuk tanggal berapa?");
  assert.equal(pairs[1].incoming, "Tanggal 12\nBisa DP berapa?");
  assert.equal(pairs[1].reply, "DP 50% ya kak!");
});

test("a reply after a long gap is not used as an example", () => {
  const late = [msg("Cust", "Halo", 0), { ...msg("Me", "Halo juga", 0), at: new Date(Date.UTC(2026, 0, 2, 10, 0)) }];
  assert.equal(buildReplyPairs(late, "Me").length, 0);
});

test("a message from me with no preceding question is ignored", () => {
  assert.equal(buildReplyPairs([msg("Me", "Selamat pagi", 0)], "Me").length, 0);
});
