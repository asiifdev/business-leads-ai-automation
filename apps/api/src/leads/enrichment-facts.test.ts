import { test } from "node:test";
import assert from "node:assert/strict";
import { aboutLine } from "./enrichment-facts";

test("the lead's own description, type and hours become one line", () => {
  assert.equal(aboutLine({ about: { description: "Kopi  susu\nand roti.", type: "Restaurant", hours: "Mon-Fri 08:00-21:00", phones: ["1"] } }), "Kopi susu and roti. | type: Restaurant | hours: Mon-Fri 08:00-21:00");
});

test("nothing found, or stored data of the wrong shape, gives null", () => {
  for (const v of [null, undefined, "x", 5, {}, { about: null }, { about: "x" }, { about: { phones: [], emails: [] } }, { about: { description: 5 } }]) assert.equal(aboutLine(v), null);
  assert.equal(aboutLine({ about: { description: "x".repeat(1000) } })?.length, 300);
});
