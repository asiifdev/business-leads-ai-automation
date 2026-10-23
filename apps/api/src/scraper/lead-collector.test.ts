import { test } from "node:test";
import assert from "node:assert/strict";
import { LeadCollectorService } from "./lead-collector.service";
import type { LeadSource, RawSourceLead, SourceRequest } from "./sources/lead-source";

const lead = (name: string, phone: string, source: string, over: Partial<RawSourceLead> = {}): RawSourceLead => ({
  name, address: "", phone, website: "", rating: "N/A", reviewCount: null, category: "", hasWebsite: false, referenceUrl: "", lat: null, lng: null, businessStatus: null, source, ...over,
});

function fake(id: string, make: (req: SourceRequest) => RawSourceLead[] | Error): LeadSource & { asked: number[] } {
  const s = { id, asked: [] as number[], async search(req: SourceRequest) { s.asked.push(req.maxResults); await req.onProgress?.(100); const r = make(req); if (r instanceof Error) throw r; return r; } };
  return s;
}

const base = { searchQueries: ["toko kamera"], location: "Bandung", industry: "x" };

function collector(...sources: LeadSource[]) {
  const c = new LeadCollectorService(fake("google_maps", () => []) as never);
  for (const s of sources) c.register(s);
  return c;
}

test("later sources are asked only for what the earlier ones left", async () => {
  const maps = fake("google_maps", () => [lead("A", "081200000001", "google_maps"), lead("B", "081200000002", "google_maps")]);
  const osm = fake("osm", () => [lead("C", "081200000003", "osm")]);
  const r = await collector(maps, osm).collect({ ...base, sources: ["google_maps", "osm"], maxResults: 5 });
  assert.deepEqual(maps.asked, [5]);
  assert.deepEqual(osm.asked, [3]);
  assert.equal(r.leads.length, 3);
  assert.deepEqual(r.perSource, { google_maps: 2, osm: 1 });
});

test("a source is skipped when the target is already met", async () => {
  const maps = fake("google_maps", () => [lead("A", "081200000001", "google_maps")]);
  const osm = fake("osm", () => [lead("C", "081200000003", "osm")]);
  const r = await collector(maps, osm).collect({ ...base, sources: ["google_maps", "osm"], maxResults: 1 });
  assert.equal(osm.asked.length, 0);
  assert.equal(r.leads.length, 1);
});

test("the same business from two sources becomes one lead", async () => {
  const maps = fake("google_maps", () => [lead("Contoh", "081200000001", "google_maps")]);
  const osm = fake("osm", () => [lead("Contoh", "+6281200000001", "osm", { website: "https://contoh.example.com" })]);
  const r = await collector(maps, osm).collect({ ...base, sources: ["google_maps", "osm"], maxResults: 10 });
  assert.equal(r.leads.length, 1);
  assert.equal(r.leads[0].website, "https://contoh.example.com");
});

test("a failing source is a warning while another still found leads, and an error when nothing was found", async () => {
  const maps = fake("google_maps", () => [lead("A", "081200000001", "google_maps")]);
  const osm = fake("osm", () => new Error("Overpass is busy"));
  const r = await collector(maps, osm).collect({ ...base, sources: ["google_maps", "osm"], maxResults: 10 });
  assert.equal(r.leads.length, 1);
  assert.deepEqual(r.warnings, ["osm: Overpass is busy"]);
  await assert.rejects(collector(fake("osm", () => new Error("Overpass is busy"))).collect({ ...base, sources: ["osm"], maxResults: 10 }), /Overpass is busy/);
});

test("a source that finds nothing is not an error", async () => {
  const r = await collector(fake("osm", () => [])).collect({ ...base, sources: ["osm"], maxResults: 10 });
  assert.equal(r.leads.length, 0);
  assert.deepEqual(r.warnings, []);
});

test("an unknown source is reported: as a warning next to leads, as an error without any", async () => {
  const maps = fake("google_maps", () => [lead("A", "081200000001", "google_maps")]);
  const r = await collector(maps).collect({ ...base, sources: ["google_maps", "nope"], maxResults: 10 });
  assert.deepEqual(r.warnings, ["nope: this source is not available"]);
  await assert.rejects(collector().collect({ ...base, sources: ["nope"], maxResults: 10 }), /not available/);
});

test("progress runs through all sources", async () => {
  const seen: number[] = [];
  await collector(fake("google_maps", () => []), fake("osm", () => [])).collect({ ...base, sources: ["google_maps", "osm"], maxResults: 10, onProgress: (p) => { seen.push(p); } });
  assert.deepEqual(seen, [50, 100]);
});

test("fixture mode uses only the Maps source", async () => {
  process.env.SCRAPER_MODE = "fixture";
  try {
    const osm = fake("osm", () => [lead("C", "081200000003", "osm")]);
    const maps = fake("google_maps", () => [lead("[Test data] 1", "", "fixture")]);
    const r = await collector(maps, osm).collect({ ...base, sources: ["osm"], maxResults: 10 });
    assert.equal(osm.asked.length, 0);
    assert.equal(r.leads[0].source, "fixture");
  } finally { delete process.env.SCRAPER_MODE; }
});
