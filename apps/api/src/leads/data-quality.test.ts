import { test } from "node:test";
import assert from "node:assert/strict";
import { assessQuality, qualityAllows, draftGate, qualityRiskLabels, lastChecked, websiteReadDue } from "./data-quality";

const now = new Date("2026-10-21T00:00:00Z");
const fresh = new Date("2026-10-01T00:00:00Z");
const old = new Date("2026-01-01T00:00:00Z");

test("a fresh lead with a phone and no problems is high", () => {
  assert.deepEqual(assessQuality({ phone: "0812", phoneE164: "62812", scrapedAt: fresh }, now), { level: "high", issues: [] });
});

test("closed, duplicate and unreachable-by-WhatsApp leads are low", () => {
  assert.equal(assessQuality({ phone: "1", businessStatus: "permanently_closed", scrapedAt: fresh }, now).level, "low");
  assert.equal(assessQuality({ phone: "1", duplicateOfId: "x", scrapedAt: fresh }, now).level, "low");
  assert.equal(assessQuality({ phone: "1", validation: { waRegistered: false }, scrapedAt: fresh }, now).level, "low");
  assert.equal(assessQuality({ scrapedAt: fresh }, now).issues[0], "no_contact");
});

test("a number off WhatsApp is not blocking when there is a working email", () => {
  const r = assessQuality({ phone: "1", email: "a@example.com", validation: { waRegistered: false, emailMx: true }, scrapedAt: fresh }, now);
  assert.equal(r.level, "medium");
  assert.deepEqual(r.issues, ["phone_not_on_whatsapp"]);
});

test("temporary closing, a dead website and old data lower the lead to medium", () => {
  assert.equal(assessQuality({ phone: "1", businessStatus: "temporarily_closed", scrapedAt: fresh }, now).level, "medium");
  assert.deepEqual(assessQuality({ phone: "1", validation: { websiteLive: false }, scrapedAt: fresh }, now).issues, ["website_unreachable"]);
  assert.deepEqual(assessQuality({ phone: "1", validation: { websiteParked: true }, scrapedAt: fresh }, now).issues, ["website_parked"]);
  assert.deepEqual(assessQuality({ phone: "1", scrapedAt: old }, now).issues, ["stale"]);
  assert.equal(assessQuality({ phone: "1", scrapedAt: old, enrichedAt: fresh }, now).level, "high");
});

test("only low is kept out of bulk drafting", () => {
  assert.equal(qualityAllows("low"), false);
  assert.equal(qualityAllows("medium"), true);
  assert.equal(qualityAllows(null), true);
});

test("draftGate names the reason a lead is left out, per channel", () => {
  assert.equal(draftGate({ phone: "1", scrapedAt: fresh }, "whatsapp", now), null);
  assert.equal(draftGate({ phone: "1", businessStatus: "permanently_closed", scrapedAt: fresh }, "whatsapp", now), "lowQuality");
  assert.equal(draftGate({ phone: "1", email: "a@example.com", validation: { waRegistered: false, emailMx: true }, scrapedAt: fresh }, "whatsapp", now), "notOnWhatsapp");
  assert.equal(draftGate({ phone: "1", email: "a@example.com", validation: { waRegistered: false, emailMx: true }, scrapedAt: fresh }, "email", now), null);
  assert.equal(draftGate({ email: "a@nope.example", validation: { emailMx: false }, scrapedAt: fresh }, "email", now), "badEmail");
  assert.equal(draftGate({ email: "a@example.com", duplicateOfId: "x", scrapedAt: fresh }, "email", now), "lowQuality");
});

test("qualityRiskLabels lists the problems a reviewer should see on a draft", () => {
  assert.deepEqual(qualityRiskLabels({ phone: "1", scrapedAt: old, validation: { websiteLive: false } }, now), ["website-unreachable", "stale-data"]);
  assert.deepEqual(qualityRiskLabels({ phone: "1", scrapedAt: fresh }, now), []);
});

test("a check of the number or address counts as looking at the lead again", () => {
  const recent = { phone: "1", scrapedAt: old, validation: { waRegistered: true, checkedAt: fresh.toISOString() } };
  assert.equal(lastChecked(recent)?.getTime(), fresh.getTime());
  assert.equal(assessQuality(recent, now).level, "high");
  assert.equal(lastChecked({}), null);
});

test("qualityRiskLabels also names the problems that block bulk drafting", () => {
  assert.deepEqual(qualityRiskLabels({ phone: "1", businessStatus: "permanently_closed", duplicateOfId: "x", scrapedAt: fresh }, now), ["permanently-closed", "duplicate-lead"]);
});

test("a website is read again when it was never read or the reading is old", () => {
  assert.equal(websiteReadDue({ website: null, enrichedAt: null }, now), false);
  assert.equal(websiteReadDue({ website: "https://example.com", enrichedAt: null }, now), true);
  assert.equal(websiteReadDue({ website: "https://example.com", enrichedAt: fresh }, now), false);
  assert.equal(websiteReadDue({ website: "https://example.com", enrichedAt: old }, now), true);
});
