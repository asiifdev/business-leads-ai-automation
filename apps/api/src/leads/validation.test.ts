import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEmailDomain, looksParked, mergeValidation, withSource, qualityColumns, waCheckDue } from "./validation";

const err = (code: string) => Object.assign(new Error(code), { code });

test("an address whose domain has mail records is deliverable", async () => {
  assert.equal(await checkEmailDomain("a@example.com", async () => [{ exchange: "mx.example.com" }]), true);
});

test("a domain with only an address record still counts, as mail rules allow", async () => {
  assert.equal(await checkEmailDomain("a@example.com", async () => { throw err("ENODATA"); }, async () => ["1.2.3.4"]), true);
});

test("a domain that does not exist is not deliverable", async () => {
  const gone = async () => { throw err("ENOTFOUND"); };
  assert.equal(await checkEmailDomain("a@no-such.example", gone, gone), false);
  assert.equal(await checkEmailDomain("broken", gone, gone), false);
});

test("a network failure is unknown, never a verdict", async () => {
  const down = async () => { throw err("ECONNREFUSED"); };
  assert.equal(await checkEmailDomain("a@example.com", down, down), null);
});

test("looksParked finds placeholder sites and not real ones", () => {
  assert.equal(looksParked("This domain is for sale. Contact the owner."), true);
  assert.equal(looksParked("Website dalam pengembangan"), true);
  assert.equal(looksParked("Contoh Studio melayani foto produk di Jakarta."), false);
  assert.equal(looksParked("a".repeat(500000)), false);
});

test("validation and field sources are merged with a timestamp", () => {
  const now = new Date("2026-10-21T00:00:00Z");
  assert.deepEqual(mergeValidation({ emailMx: true }, { waRegistered: false }, now), { emailMx: true, waRegistered: false, checkedAt: now.toISOString() });
  assert.deepEqual(withSource({ phone: { source: "google_maps", at: "x" } }, ["email"], "website", now), { phone: { source: "google_maps", at: "x" }, email: { source: "website", at: now.toISOString() } });
});

test("qualityColumns gives the stored level and reasons", () => {
  assert.deepEqual(qualityColumns({ phone: "1", duplicateOfId: "x", scrapedAt: new Date() }), { dataQuality: "low", qualityIssues: ["duplicate"] });
});

test("a WhatsApp lookup is repeated only when missing or old", () => {
  const now = new Date("2026-10-21T00:00:00Z");
  assert.equal(waCheckDue({}, now), true);
  assert.equal(waCheckDue({ waRegistered: true, checkedAt: "2026-10-10T00:00:00Z" }, now), false);
  assert.equal(waCheckDue({ waRegistered: true, checkedAt: "2026-08-01T00:00:00Z" }, now), true);
});
