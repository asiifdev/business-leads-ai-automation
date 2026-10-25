import test from "node:test";
import assert from "node:assert/strict";
import { GoogleMapsSource } from "./google-maps.source";
import type { GoogleMapsScraperService } from "../google-maps.scraper";

function source(single: boolean) {
  const calls = { scrape: [] as { query: string; area?: string; country?: string }[], single: [] as string[] };
  const maps = {
    async isSinglePlace(text: string) { calls.single.push(text); return single; },
    async scrape(query: string, _n: number, opts: { area?: string; country?: string }) { calls.scrape.push({ query, ...opts }); return []; },
  } as unknown as GoogleMapsScraperService;
  return { s: new GoogleMapsSource(maps), calls };
}
const req = (location: string, country: string) => ({ searchQueries: ["tire shop"], location, country, industry: "x", maxResults: 5 });

test("outside Indonesia a text Maps knows as one place is searched as one place", async () => {
  const { s, calls } = source(true);
  await s.search(req("Pocahontas, Arkansas", "US"));
  assert.deepEqual(calls.single, ["Pocahontas, Arkansas"]);
  assert.deepEqual(calls.scrape.map((c) => c.area), ["Pocahontas, Arkansas"]);
  assert.equal(calls.scrape[0].country, "US");
});

test("outside Indonesia a list Maps does not know as one place is split", async () => {
  const { s, calls } = source(false);
  await s.search(req("Cairo, Giza", "EG"));
  assert.deepEqual(calls.scrape.map((c) => c.area), ["Cairo", "Giza"]);
  assert.ok(calls.scrape.every((c) => c.country === "EG"));
});

test("Indonesian campaigns split as always and never ask", async () => {
  const { s, calls } = source(true);
  await s.search(req("Medan, Batam", "ID"));
  assert.deepEqual(calls.single, []);
  assert.deepEqual(calls.scrape.map((c) => c.area), ["Medan", "Batam"]);
});

test("a single place with no separator is not checked", async () => {
  const { s, calls } = source(true);
  await s.search(req("Riyadh", "SA"));
  assert.deepEqual(calls.single, []);
  assert.deepEqual(calls.scrape.map((c) => c.area), ["Riyadh"]);
});
