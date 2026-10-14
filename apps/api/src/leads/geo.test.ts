import test from "node:test";
import assert from "node:assert/strict";
import { cellKey, normalizeProvince, regionFromNominatim } from "./geo";

test("a Nominatim answer for Semarang becomes province, regency and district", () => {
  assert.deepEqual(
    regionFromNominatim({ suburb: "Mugassari", district: "Semarang Selatan", city: "Kota Semarang", state: "Jawa Tengah", country_code: "id" } as never),
    { province: "Jawa Tengah", regency: "Kota Semarang", district: "Semarang Selatan" },
  );
});

test("a kabupaten comes from county, and Jakarta is named one way", () => {
  assert.equal(regionFromNominatim({ county: "Kabupaten Bogor", state: "Jawa Barat", country_code: "id" })?.regency, "Kabupaten Bogor");
  assert.equal(normalizeProvince("Daerah Khusus Ibukota Jakarta"), "DKI Jakarta");
  assert.equal(normalizeProvince("Daerah Istimewa Yogyakarta"), "DI Yogyakarta");
});

test("a place outside Indonesia or an empty answer gives nothing", () => {
  assert.equal(regionFromNominatim({ state: "Mombasa County", country_code: "ke" }), null);
  assert.equal(regionFromNominatim(undefined), null);
  assert.equal(regionFromNominatim({ country_code: "id" }), null);
});

test("leads a few hundred metres apart share one lookup", () => {
  assert.equal(cellKey(-6.9932, 110.4203), cellKey(-6.9951, 110.4189));
  assert.notEqual(cellKey(-6.9932, 110.4203), cellKey(-7.1, 110.5));
});

test("Jakarta: no state in the answer, kota administrasi as regency and kecamatan as district", () => {
  assert.deepEqual(
    regionFromNominatim({ suburb: "Duren Sawit", city_district: "Jakarta Timur", city: "Daerah Khusus Ibukota Jakarta", country_code: "id" }),
    { province: "DKI Jakarta", regency: "Jakarta Timur", district: "Duren Sawit" },
  );
  assert.deepEqual(
    regionFromNominatim({ city_district: "Jakarta Selatan", city: "Daerah Khusus Ibukota Jakarta", country_code: "id" }),
    { province: "DKI Jakarta", regency: "Jakarta Selatan", district: null },
  );
});
