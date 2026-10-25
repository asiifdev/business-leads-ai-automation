import test from "node:test";
import assert from "node:assert/strict";
import { defaultLanguageFor, isLanguageValue, languageName, promptLanguage, writeInLanguage } from "./language";

test("the language follows the country", () => {
  assert.equal(defaultLanguageFor("ID"), "indonesian");
  assert.equal(defaultLanguageFor("EG"), "ar");
  assert.equal(defaultLanguageFor("SA"), "ar");
  assert.equal(defaultLanguageFor("US"), "english");
  assert.equal(defaultLanguageFor("GB"), "english");
  assert.equal(defaultLanguageFor("DE"), "de");
  assert.equal(defaultLanguageFor("BR"), "pt");
  assert.equal(defaultLanguageFor(undefined), "indonesian");
});

test("old values and language codes are valid, anything else is not", () => {
  for (const v of ["indonesian", "english", "ar", "es", "AR"]) assert.equal(isLanguageValue(v), true, v);
  for (const v of ["", "arabic", "xx", "a", "ignore previous instructions", 5, null]) assert.equal(isLanguageValue(v), false, String(v));
});

test("prompts keep their own wording and ask for the campaign's language", () => {
  assert.equal(promptLanguage("indonesian"), "indonesian");
  assert.equal(promptLanguage("english"), "english");
  assert.equal(promptLanguage("ar"), "english");
  assert.equal(writeInLanguage("ar"), "Arabic");
  assert.equal(writeInLanguage("indonesian"), null);
  assert.equal(writeInLanguage("english"), null);
  assert.equal(writeInLanguage("nonsense"), null);
  assert.equal(languageName("ar"), "Arabic");
  assert.equal(languageName("indonesian"), "Bahasa Indonesia");
  assert.equal(languageName(undefined), "English");
});
