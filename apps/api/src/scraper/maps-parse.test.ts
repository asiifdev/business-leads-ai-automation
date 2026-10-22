import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRating, pickCategory, businessStatusFrom } from "./maps-parse";

test("normalizeRating handles Indonesian and English formats", () => {
  assert.equal(normalizeRating("4,6"), "4.6");
  assert.equal(normalizeRating("5,0"), "5.0");
  assert.equal(normalizeRating("4.9"), "4.9");
  assert.equal(normalizeRating("N/A"), "");
  assert.equal(normalizeRating(undefined), "");
  assert.equal(parseFloat(normalizeRating("4,6")), 4.6);
});

test("pickCategory reads the first segment of the info line (real cards from Google Maps)", () => {
  assert.equal(pickCategory(["5,0(2.623)", "Pemasok Perlengkapan Audio Visual · Jl. Kahuripan Barat II No.64Buka · Tutup pukul 22.00 · 0852-1557-9066", "Pemasok Perlengkapan Audio Visual · Jl. Kahuripan Barat II No.64", "Buka · Tutup pukul 22.00 · 0852-1557-9066"]), "Pemasok Perlengkapan Audio Visual");
  assert.equal(pickCategory(["4,9(2.943)", "Toko Kamera · Jl. Al Ikhlas", "Buka · Tutup pukul 22.30 · 0882-2999-0666"]), "Toko Kamera");
  assert.equal(pickCategory(["4.5(120)", "Coffee shop · 12 Main St", "Open · Closes 10 pm"]), "Coffee shop");
});

test("pickCategory ignores rating, hours and addresses; returns empty when unsure", () => {
  assert.equal(pickCategory(["4,5(10)", "Buka · Tutup pukul 21.00", "Jl. Merdeka No. 3 · 0812-3456-7890"]), "");
  assert.equal(pickCategory([]), "");
  assert.equal(pickCategory(["Jl. Slamet Riyadi 12 · Solo"]), "");
});

test("businessStatusFrom reads closed listings in both languages and ignores closing hours", () => {
  assert.equal(businessStatusFrom(["Toko Kamera · Jl. Contoh No.1", "Tutup permanen"]), "permanently_closed");
  assert.equal(businessStatusFrom(["Permanently closed"]), "permanently_closed");
  assert.equal(businessStatusFrom(["Sementara tutup"]), "temporarily_closed");
  assert.equal(businessStatusFrom(["Buka · Tutup pukul 22.00"]), null);
});
