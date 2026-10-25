import test from "node:test";
import assert from "node:assert/strict";
import { internationalFor, isMobileDigits, phoneDigitsFor } from "./phone-intl";

test("Indonesian numbers keep the existing rules", () => {
  assert.equal(phoneDigitsFor("0812-3456-7890", "ID"), "6281234567890");
  assert.equal(internationalFor("+62 812 3456 7890", "ID"), "+6281234567890");
});

test("a national number is read in the campaign's country", () => {
  assert.equal(internationalFor("010 1234 5678", "EG"), "+201012345678");
  assert.equal(internationalFor("+20 10 1234 5678", "EG"), "+201012345678");
  assert.equal(internationalFor("050 123 4567", "SA"), "+966501234567");
  assert.equal(internationalFor("(501) 555-0123", "US"), "+15015550123");
});

test("a number from another country written with its code still counts", () => {
  assert.equal(internationalFor("+966 50 123 4567", "EG"), "+966501234567");
});

test("anything that is not a valid number is dropped", () => {
  for (const x of ["", "abc", "123", "4.9", "(1,234)", "0000000000"]) assert.equal(internationalFor(x, "EG"), "", x);
  assert.equal(phoneDigitsFor(null, "EG"), null);
});

test("mobile numbers are told from fixed lines by the numbering plan", () => {
  assert.equal(isMobileDigits("6281234567890"), true);
  assert.equal(isMobileDigits("201012345678"), true); // Egypt 010 is mobile
  assert.equal(isMobileDigits("20223456789"), false); // Cairo fixed line
  assert.equal(isMobileDigits("966501234567"), true);
  assert.equal(isMobileDigits("12"), false);
});
