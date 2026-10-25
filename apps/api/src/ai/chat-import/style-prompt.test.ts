import { strict as assert } from "node:assert";
import { test } from "node:test";
import { anonymize } from "./anonymize";
import { buildDraftMessages, cosine } from "./style-prompt";
import type { StyleStats } from "./style-stats";

const stats: StyleStats = { messageCount: 10, avgChars: 40, medianChars: 30, avgWords: 7, emojiRate: 0.1, exclamationRate: 0.05, questionRate: 0.2, lowercaseStartRate: 0.5, noEndPunctuationRate: 0.8, multiLineRate: 0.1, topOpeners: [{ word: "siap", count: 3 }], topClosers: [{ word: "kak", count: 4 }], topEmoji: [{ emoji: "🙏", count: 2 }], language: { indonesian: 1, english: 0 } };

test("anonymize masks phones, emails and links", () => {
  assert.equal(anonymize("Hubungi 0812-3456-7890 atau a.b@mail.co.id di https://x.com/y"), "Hubungi <nomor> atau <email> di <link>");
  assert.equal(anonymize("DP 500000 ya"), "DP 500000 ya");
});

test("cosine similarity", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([], []), 0);
});

test("draft prompt carries style, examples and the no-invention rule", () => {
  const m = buildDraftMessages({ businessDescription: "rental kebaya", style: stats, examples: [{ incoming: "ready?", reply: "ready kak", at: new Date() }], incoming: "tgl 12 ada?" });
  assert.match(m[0].content, /rata-rata 40 karakter/);
  assert.match(m[0].content, /Balasan saya: Ready, Kak\./); // examples are shown in standard spelling
  assert.match(m[0].content, /jangan menyebut harga/);
  assert.match(m[1].content, /tgl 12 ada\?/);
});

test("knowledge facts are listed when provided", () => {
  const m = buildDraftMessages({ businessDescription: "x", style: stats, examples: [], knowledge: ["Sewa 3 hari Rp150.000"], incoming: "harga?" });
  assert.match(m[0].content, /- Sewa 3 hari Rp150\.000/);
});

test("sloppy chat habits are never described as something to imitate", () => {
  const m = buildDraftMessages({ businessDescription: "x", style: { ...stats, lowercaseStartRate: 0.9, noEndPunctuationRate: 0.95 }, examples: [], incoming: "halo" });
  assert.doesNotMatch(m[0].content, /huruf kecil di|tanpa tanda baca pada|diawali huruf kecil/);
  assert.match(m[0].content, /ejaan baku \(PUEBI\)/);
});

import { buildOutreachMessages } from "./style-prompt";
import { buildFitMessages } from "../fit.service";

test("a campaign in another language asks the model to write in it, in the same prompt wording as English", () => {
  const base = { businessDescription: "Example Digital Agency", offer: "website design", language: "english" as const, lead: { name: "Cafe Corniche" } };
  const ar = buildOutreachMessages({ ...base, writeIn: "Arabic" })[0].content;
  assert.match(ar, /LANGUAGE: write the whole message.* in Arabic/);
  assert.doesNotMatch(buildOutreachMessages(base)[0].content, /LANGUAGE: write the whole message/);
  assert.doesNotMatch(buildOutreachMessages({ ...base, language: "indonesian" })[0].content, /LANGUAGE: write the whole message/);
});

test("the fit reason is asked for in the campaign's language", () => {
  const sys = (language: string) => buildFitMessages({ offer: "o", targets: "", language, leads: [{ name: "x" }] })[0].content;
  assert.match(sys("ar"), /dalam Arabic/);
  assert.match(sys("indonesian"), /dalam Bahasa Indonesia/);
  assert.match(sys("english"), /dalam English/);
});
