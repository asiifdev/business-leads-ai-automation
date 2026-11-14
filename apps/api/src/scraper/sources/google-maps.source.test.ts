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

/** Each area has a pool of businesses; every query shows the pool from a different starting point, so queries overlap the way real ones do. */
function pooled(poolSize: number) {
  const asked: { query: string; area: string; n: number }[] = [];
  const maps = {
    async isSinglePlace() { return false; },
    async scrape(query: string, n: number, opts: { area?: string }) {
      asked.push({ query, area: opts.area ?? "", n });
      const offset = ["tiga", "empat", "lima", "enam"].findIndex((w) => query.includes(w)) * 3;
      return Array.from({ length: Math.min(n, poolSize) }, (_, i) => (offset + i) % poolSize).map((k) => ({
        name: `${opts.area} Toko ${k}`, address: `Jl. ${opts.area} ${k}`, phone: `08120000${String(k).padStart(2, "0")}${(opts.area ?? "").length}`, website: "", rating: "N/A", hasWebsite: false, referenceLink: "", lat: -7, lng: 110, category: "Toko",
      }));
    },
  } as unknown as GoogleMapsScraperService;
  return { s: new GoogleMapsSource(maps), asked };
}

test("a list of places gets an even share each, asked for in full, and finished places skip their remaining queries", async () => {
  const { s, asked } = pooled(30);
  const out = await s.search({ searchQueries: ["toko tiga", "toko empat", "toko lima", "toko enam"], location: "Solo, Klaten, Boyolali", country: "ID", industry: "x", maxResults: 30 });
  const byArea = (a: string) => out.filter((l) => l.address.includes(a)).length;
  assert.equal(out.length, 30);
  assert.ok([byArea("Solo"), byArea("Klaten"), byArea("Boyolali")].every((n) => n === 10), `${byArea("Solo")}/${byArea("Klaten")}/${byArea("Boyolali")}`);
  assert.ok(asked.every((a) => a.n >= 10), "no search is asked for a thin slice");
  assert.ok(asked.length < 12, `${asked.length} searches for 3 places x 4 queries: the places that were done skipped the rest`);
});

test("a place that has fewer businesses than its share hands the gap on to the next places", async () => {
  const asked: string[] = [];
  const maps = {
    async isSinglePlace() { return false; },
    async scrape(query: string, _n: number, opts: { area?: string }) {
      asked.push(`${opts.area}`);
      const n = opts.area === "Solo" ? 3 : 40; // Solo has only three
      return Array.from({ length: n }, (_, k) => ({ name: `${opts.area} Toko ${k}`, address: `Jl. ${opts.area} ${k}`, phone: `0813${opts.area}${k}`.replace(/\D/g, "0").padEnd(10, "1"), website: "", rating: "N/A", hasWebsite: false, referenceLink: "", lat: -7, lng: 110, category: "Toko" }));
    },
  } as unknown as GoogleMapsScraperService;
  const out = await new GoogleMapsSource(maps).search({ searchQueries: ["a"], location: "Solo, Klaten", country: "ID", industry: "x", maxResults: 20 });
  assert.equal(out.filter((l) => l.address.includes("Klaten")).length >= 10, true);
  assert.ok(out.length >= 13, `${out.length}: Klaten took more than its first share of ten`);
});
