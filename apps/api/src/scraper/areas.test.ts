import { test } from "node:test";
import assert from "node:assert/strict";
import { INDONESIA_CITIES, haversineKm, inArea, isNationwide, planAreas, splitAreas, stripPlaces } from "./areas";

test("country-wide wording is recognised, a real place is not", () => {
  for (const v of ["Indonesia", "seluruh Indonesia", "Seluruh  indonesia", "semua Indonesia", "nasional", "All Indonesia", "nationwide"]) assert.equal(isNationwide(v), true, v);
  for (const v of ["Solo", "Jakarta, Bandung", "Indonesia Timur", "Kota Surabaya"]) assert.equal(isNationwide(v), false, v);
});

test("typed cities stay exactly as typed", () => {
  const p = planAreas("Solo, Yogyakarta ,Klaten", 2, 120);
  assert.deepEqual(p.areas, ["Solo", "Yogyakarta", "Klaten"]);
  assert.equal(p.nationwide, false);
  assert.equal(p.perSearch, 20);
});

test("a nationwide campaign becomes a list of cities big enough for the target, biggest markets first", () => {
  const p = planAreas("Seluruh Indonesia", 10, 1500);
  assert.equal(p.nationwide, true);
  assert.equal(p.areas[0], "Jakarta");
  assert.equal(p.areas.length, 20); // 1500 x 1.6 / (10 queries x 12 per search)
  assert.equal(new Set(p.areas).size, p.areas.length);
  assert.ok(p.perSearch >= 12 && p.perSearch <= 40);
  assert.ok(p.areas.length * 10 * p.perSearch >= 1500 * 1.6 - 1, "enough raw results to survive duplicates");
});

test("small and huge targets stay inside sensible bounds", () => {
  assert.equal(planAreas("Indonesia", 1, 30).areas.length, 8); // never fewer than 8 cities
  assert.equal(planAreas("Indonesia", 1, 100000).areas.length, INDONESIA_CITIES.length); // never more than the list
  assert.equal(planAreas("Indonesia", 0, 500).areas.length > 0, true); // zero queries does not divide by zero
});

test("the city list has no duplicates and no blanks", () => {
  assert.equal(new Set(INDONESIA_CITIES).size, INDONESIA_CITIES.length);
  assert.ok(INDONESIA_CITIES.every((c) => c.trim().length > 2));
});

test("every way people list several cities becomes separate places", () => {
  assert.deepEqual(splitAreas("yogyakarta, medan dan semarang"), ["yogyakarta", "medan", "semarang"]);
  assert.deepEqual(splitAreas("Solo & Jogja"), ["Solo", "Jogja"]);
  assert.deepEqual(splitAreas("Medan; Batam / Pekanbaru"), ["Medan", "Batam", "Pekanbaru"]);
  assert.deepEqual(splitAreas("Bandung\nBogor\r\nDepok"), ["Bandung", "Bogor", "Depok"]);
  assert.deepEqual(splitAreas("Jakarta atau Bekasi serta Tangerang"), ["Jakarta", "Bekasi", "Tangerang"]);
  assert.deepEqual(splitAreas("di Kota Malang"), ["Malang"]);
  assert.deepEqual(splitAreas("Medan, medan"), ["Medan"]); // duplicates collapse
  assert.deepEqual(splitAreas("  "), []);
});

test("a city inside the search phrase is removed so the campaign's areas decide where to look", () => {
  assert.equal(stripPlaces("sewa kamera Solo", ["Medan"]), "sewa kamera");
  assert.equal(stripPlaces("rental kamera di Jogja"), "rental kamera");
  assert.equal(stripPlaces("sewa mobil Surabaya Indonesia"), "sewa mobil");
  assert.equal(stripPlaces("sewa baju adat Medan", ["Medan"]), "sewa baju adat");
  assert.equal(stripPlaces("sewa kamera"), "sewa kamera");
  assert.equal(stripPlaces("Solo"), "Solo"); // never leave an empty search
  assert.equal(stripPlaces("sewa tenda camping"), "sewa tenda camping"); // "camping" is not a place
});

test("the user's real example plans three cities and keeps their order", () => {
  const p = planAreas("yogyakarta, medan dan semarang", 2, 90);
  assert.deepEqual(p.areas, ["yogyakarta", "medan", "semarang"]);
  assert.equal(p.perSearch, 15);
});

const MEDAN = { lat: 3.5952, lng: 98.6722 };
test("distance is measured in kilometres", () => {
  assert.ok(Math.abs(haversineKm({ lat: -7.5666, lng: 110.8167 }, { lat: -7.7956, lng: 110.3695 }) - 55) < 6); // Solo to Yogyakarta, about 55 km
  assert.equal(Math.round(haversineKm(MEDAN, MEDAN)), 0);
});

test("results from another city are dropped, however Google ranked them", () => {
  const rows = [
    { name: "in Medan", lat: 3.58, lng: 98.68, address: "Jl. A" },
    { name: "Binjai, still the metro", lat: 3.60, lng: 98.49, address: "Jl. B" },
    { name: "Klaten", lat: -7.70, lng: 110.60, address: "Jl. Ronggo Warsito, Klaten" },
    { name: "no coordinates, names the city", lat: null, lng: null, address: "Jl. C, Medan" },
    { name: "no coordinates, no city", lat: null, lng: null, address: "Jl. D" },
  ];
  const { kept, dropped } = inArea(rows, "Medan", MEDAN);
  assert.deepEqual(kept.map((r) => r.name), ["in Medan", "Binjai, still the metro", "no coordinates, names the city"]);
  assert.equal(dropped, 2);
});
