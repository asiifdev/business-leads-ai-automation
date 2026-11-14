import test from "node:test";
import assert from "node:assert/strict";
import { extractJsonObject } from "./json-extract";

test("reads the first object from prose, fences and trailing text", () => {
  assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJsonObject('Here you go:\n```json\n{"a":{"b":"x"}}\n```\nHope it helps'), { a: { b: "x" } });
  assert.deepEqual(extractJsonObject('{"a":1}\n{"b":2}'), { a: 1 }); // "non-whitespace after JSON"
  assert.deepEqual(extractJsonObject('{"a":"} not the end { "}'), { a: "} not the end { " });
  assert.deepEqual(extractJsonObject('{"a":"quote \\" and } brace"}'), { a: 'quote " and } brace' });
});

test("an answer cut off, or with no object, gives null and never throws", () => {
  assert.equal(extractJsonObject('{"email":{"subject":"Hi","body":"cut off here'), null); // "Unterminated string"
  assert.equal(extractJsonObject("no json at all"), null);
  assert.equal(extractJsonObject(""), null);
  assert.equal(extractJsonObject("{not json}"), null);
  const hostile = "{".repeat(200_000);
  const t0 = Date.now();
  assert.equal(extractJsonObject(hostile), null);
  assert.ok(Date.now() - t0 < 500);
});
