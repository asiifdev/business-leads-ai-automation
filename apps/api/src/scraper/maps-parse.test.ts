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

import { looksLikePhone, pickAddress, pickPhone } from "./maps-parse";
import { cardPhone } from "./google-maps.scraper";

test("the address is what follows the category on the card, in any country", () => {
  // rows as Google Maps shows them: the same text nested, the longer ones with the opening hours glued on
  const rows = ["4.9", "Coffee shop · 55 Nile CornicheOpen · Closes 4 AM", "Coffee shop · 55 Nile Corniche", "Open · Closes 4 AM"];
  assert.equal(pickAddress(rows, "Coffee shop"), "55 Nile Corniche");
  assert.equal(pickAddress(["Cafe · el waili , salah salem, abbasyaOpen 24 hours", "Cafe · el waili , salah salem, abbasya", "Open 24 hours"], "Cafe"), "el waili , salah salem, abbasya");
  assert.equal(pickAddress(["Restoran · Jl. Merdeka No. 5", "Buka · Tutup 22.00"], "Restoran"), "Jl. Merdeka No. 5");
});

test("service options, opening hours and phone numbers are not part of the address", () => {
  assert.equal(pickAddress(["Cafe · Dine-in · Takeaway · Delivery"], "Cafe"), "");
  assert.equal(pickAddress(["Cafe · 12 Main St · +20 10 1234 5678"], "Cafe"), "12 Main St");
  assert.equal(pickAddress(["Open · Closes 4 AM"], "Cafe"), "");
  assert.equal(pickAddress([], ""), "");
});

test("a phone number is found in any format and nothing else is mistaken for one", () => {
  assert.equal(pickPhone(["Cafe · 12 Main St · 010 1234 5678"]), "010 1234 5678");
  assert.equal(pickPhone(["Cafe · 12 Main St", "4.9"]), "");
  for (const x of ["4.9", "(1,234)", "12:30", "55 Nile Corniche", "2024"]) assert.equal(looksLikePhone(x), false, x);
  assert.equal(looksLikePhone("+20 10 1234 5678"), true);
});

test("a card's number is read for the campaign's country", () => {
  assert.equal(cardPhone("0812-3456-7890", "ID"), "081234567890");
  assert.equal(cardPhone("+62 812 3456 7890", "ID"), "081234567890");
  assert.equal(cardPhone("010 1234 5678", "EG"), "+201012345678");
  assert.equal(cardPhone("123 456 789", "EG"), ""); // not valid there: dropped, never stored
  assert.equal(cardPhone("", "EG"), "");
});
