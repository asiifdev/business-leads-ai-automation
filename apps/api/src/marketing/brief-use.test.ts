import { test } from "node:test";
import assert from "node:assert/strict";
import { briefForDraft, pickAngle } from "./brief-use";
import { emptyBrief } from "./brief-schema";
import { buildOutreachMessages } from "../ai/chat-import/style-prompt";

const angles = [
  { segment: "Rental kamera", pain: "Stok bentrok", hook: "Jadwal sewa bentrok?", benefit: "Jadwal dan stok satu layar" },
  { segment: "Wedding organizer", pain: "Vendor berantakan", hook: "Vendor lupa jadwal?", benefit: "Semua vendor terpantau" },
];

test("pickAngle matches on the name and the real Maps category, and returns nothing when nothing overlaps", () => {
  assert.equal(pickAngle(angles, "Solo Lensa", "Layanan Rental Alat")?.segment, "Rental kamera");
  assert.equal(pickAngle(angles, "Dian Wedding", "Penyelenggara pernikahan")?.segment, "Wedding organizer");
  assert.equal(pickAngle(angles, "Warung Bu Tini", "Restoran"), undefined);
});

test("the draft prompt carries the brief: matched angle, allowed proof, words to avoid", () => {
  const c = { ...emptyBrief(), angles, proof: { metrics: ["200+ stars"], customers: ["Hikam Shughro"], testimonials: [] }, voice: { tone: "", wordsToUse: [], wordsToAvoid: ["solusi", "inovatif"] } };
  const brief = briefForDraft("Kami membuat sistem sewa.", c, { name: "Rental Kamera Solo", category: "Toko Kamera" });
  const m = buildOutreachMessages({ businessDescription: "X", offer: "sistem sewa", language: "indonesian", lead: { name: "Rental Kamera Solo" }, brief });
  const sys = m[0].content;
  assert.match(sys, /BRIEF PEMASARAN/);
  assert.match(sys, /masalah yang mungkin dirasakan: Stok bentrok; manfaat: Jadwal dan stok satu layar/);
  assert.match(sys, /Bukti yang BOLEH disebut.*Hikam Shughro; 200\+ stars/);
  assert.match(sys, /Hindari kata: solusi, inovatif/);
  const none = buildOutreachMessages({ businessDescription: "X", offer: "o", language: "indonesian", lead: { name: "Y" }, brief: { summary: "s", proof: [], wordsToAvoid: [] } })[0].content;
  assert.match(none, /Tidak ada bukti yang boleh disebut/);
  assert.doesNotMatch(buildOutreachMessages({ businessDescription: "X", offer: "o", language: "indonesian", lead: { name: "Y" } })[0].content, /BRIEF PEMASARAN/);
});

import { foreignVerticalWords } from "./brief-use";

test("a draft that names another kind of business is caught", () => {
  const angles = [
    { segment: "Rental Kamera/Alat Fotografi", pain: "", hook: "", benefit: "" },
    { segment: "Rental Kebaya/Busana", pain: "", hook: "", benefit: "" },
    { segment: "Rental Mobil/Motor", pain: "", hook: "", benefit: "" },
  ] as never;
  assert.deepEqual(foreignVerticalWords("Kami bantu catat jadwal sewa kebaya Anda.", { name: "Kostum Anak Ceria", category: "Penyewaan kostum" }, angles), ["kebaya"]);
  assert.deepEqual(foreignVerticalWords("Kami bantu jadwal sewa kamera dan lensa.", { name: "Zona Kamera", category: "Toko Elektronik" }, angles), []);
  assert.deepEqual(foreignVerticalWords("Kami bantu jadwal sewa kamera, fotografi, dan mobil.", { name: "Rental Kamera Medan", category: "Penyewaan alat" }, angles), ["mobil"]);
});
