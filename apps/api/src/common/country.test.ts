import test from "node:test";
import assert from "node:assert/strict";
import { countryName, isCountryCode } from "./country";

test("country codes become English names without a list in the code", () => {
  assert.equal(countryName("EG"), "Egypt");
  assert.equal(countryName("sa"), "Saudi Arabia");
  assert.equal(countryName("ID"), "Indonesia");
  assert.equal(countryName("US"), "United States");
});

test("anything that is not a real country code is refused", () => {
  for (const x of ["", "E", "EGY", "12", "ZZ", "XX", "EU", "UN", "AA", null, undefined]) assert.equal(isCountryCode(x), false, String(x));
  assert.equal(isCountryCode("DE"), true);
});
