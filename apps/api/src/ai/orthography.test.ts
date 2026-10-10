import { test } from "node:test";
import assert from "node:assert/strict";
import { looksIndonesian, neutralGreeting, normalizeDraft } from "./orthography";

const N = { language: "indonesian" as const, names: ["Kopi Kenangan Laweyan", "Asiifdev Digital Agency"] };

test("capitalizes sentence starts and proper names (the lowercase draft from the Outbox)", () => {
  const raw = "halo, dari asiifdev digital agency. kami lihat kopi kenangan laweyan belum punya website resmi. apakah ada rencana untuk membuat sistem reservasi online? 🙏";
  assert.equal(
    normalizeDraft(raw, N),
    "Halo, dari Asiifdev Digital Agency. Kami lihat Kopi Kenangan Laweyan belum punya website resmi. Apakah ada rencana untuk membuat sistem reservasi online? 🙏",
  );
});

test("adds terminal punctuation, with a question mark for questions", () => {
  assert.equal(normalizeDraft("halo, saya dari Asiifdev. melihat warung sudah punya banyak ulasan bagus, apakah sedang merencanakan kehadiran online ya kak", { language: "indonesian" }),
    "Halo, saya dari Asiifdev. Melihat warung sudah punya banyak ulasan bagus, apakah sedang merencanakan kehadiran online ya, Kak.");
  assert.equal(normalizeDraft("apakah bapak berminat", { language: "indonesian" }), "Apakah bapak berminat?");
  assert.equal(normalizeDraft("terima kasih atas balasannya 🙏", { language: "indonesian" }), "Terima kasih atas balasannya. 🙏");
});

test("vocative comma and Anda", () => {
  assert.equal(normalizeDraft("siap kak, nanti saya kirim ke anda", { language: "indonesian" }), "Siap, Kak, nanti saya kirim ke Anda.");
  assert.equal(normalizeDraft("terima kasih kak", { language: "indonesian" }), "Terima kasih, Kak.");
});

test("does not capitalize after abbreviations or inside numbers and links", () => {
  assert.equal(normalizeDraft("kami melayani kafe, resto, dll. dengan rating 4.6 di www.contoh.id", { language: "indonesian" }),
    "Kami melayani kafe, resto, dll. dengan rating 4,6 di www.contoh.id.");
});

test("multi-line drafts keep their paragraphs", () => {
  assert.equal(normalizeDraft("halo kak\n\nsaya dari asiifdev", { language: "indonesian", names: ["Asiifdev"] }), "Halo, Kak.\n\nSaya dari Asiifdev.");
});

test("English drafts only get capitalization and punctuation", () => {
  assert.equal(normalizeDraft("hi there, saw your cafe has 312 reviews. want a quick preview", { language: "english" }), "Hi there, saw your cafe has 312 reviews. Want a quick preview?");
});

test("looksIndonesian", () => {
  assert.equal(looksIndonesian("halo kak, saya dari asiifdev dan ingin bertanya"), true);
  assert.equal(looksIndonesian("Hi there, want a quick preview of your site?"), false);
});

test("opening time-of-day greetings become neutral", () => {
  assert.equal(neutralGreeting("Selamat sore, Kak. Saya dari Asiifdev."), "Halo, Kak. Saya dari Asiifdev.");
  assert.equal(neutralGreeting("Selamat siang, Bu Tini."), "Halo, Bu Tini.");
  assert.equal(neutralGreeting("Good morning, Sam."), "Hello, Sam.");
  assert.equal(neutralGreeting("Halo, Kak. Semoga selamat pagi Anda menyenangkan."), "Halo, Kak. Semoga selamat pagi Anda menyenangkan.");
});

test("decimal comma for ratings only", () => {
  assert.equal(normalizeDraft("Saya lihat rating 4.4 dari 95 ulasan dengan harga Rp 2.000.000", { language: "indonesian" }), "Saya lihat rating 4,4 dari 95 ulasan dengan harga Rp 2.000.000.");
});
