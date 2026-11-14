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

const base = { searchQueries: ["toko kamera"], location: "Bandung", country: "ID", industry: "x" };

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

test("mapLimit keeps order and never runs more than the limit at once", async () => {
  const { mapLimit } = await import("./lead-pipeline.service");
  let running = 0, peak = 0;
  const out = await mapLimit([5, 4, 3, 2, 1, 0], 2, async (n) => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, n)); running--; return n * 2; });
  assert.deepEqual(out, [10, 8, 6, 4, 2, 0]);
  assert.ok(peak <= 2);
  assert.deepEqual(await mapLimit([], 3, async (x) => x), []);
});

/** A source that hands over what it found in batches, as the Maps source does. */
function batching(id: string, batches: RawSourceLead[][]): LeadSource {
  return { id, async search(req: SourceRequest) { for (const b of batches) await req.onBatch?.(b); return batches.flat(); } };
}

test("leads handed over in batches are stored as they come, and the rest is left for the end", async () => {
  const a = lead("A", "081200000001", "google_maps"), b = lead("B", "081200000002", "google_maps"), c = lead("C", "081200000003", "google_maps");
  const stored: string[][] = [];
  const onBatch = async (batch: RawSourceLead[]) => { stored.push(batch.map((l) => l.name)); return batch.map((l) => `id-${l.name}`); };
  // the third lead is returned by the source but never handed over (as when a source ignores batching for part of its work)
  const maps: LeadSource = { id: "google_maps", async search(req) { await req.onBatch?.([a, b]); return [a, b, c]; } };
  const r = await collector(maps).collect({ ...base, sources: ["google_maps"], maxResults: 10, onBatch });
  assert.deepEqual(stored, [["A", "B"]]);
  assert.equal(r.savedEarly, 2);
  assert.deepEqual(r.unsaved.map((l) => l.name), ["C"]);
  assert.equal(r.leads.length, 3);
  assert.deepEqual(r.fills, []);
});

test("what a later source knows about a lead that was already stored is passed on as a fill", async () => {
  const a = lead("Contoh Toko", "081200000001", "google_maps", { address: "Jl. Mawar 1", lat: -6.2, lng: 106.8 });
  const onBatch = async (batch: RawSourceLead[]) => batch.map((l) => `id-${l.name}`);
  const maps = batching("google_maps", [[a]]);
  const overture = fake("overture", () => [lead("Contoh Toko", "081200000001", "overture", { website: "https://contoh.example.com", hasWebsite: true, address: "Jl. Mawar 1", lat: -6.2001, lng: 106.8001, email: "halo@contoh.example.com" })]);
  const r = await collector(maps, overture).collect({ ...base, sources: ["google_maps", "overture"], maxResults: 10, onBatch });
  assert.equal(r.leads.length, 1, "the same business is not added twice");
  assert.equal(r.fills.length, 1);
  assert.equal(r.fills[0].id, "id-Contoh Toko");
  assert.equal(r.fills[0].values.website, "https://contoh.example.com");
  assert.equal(r.fills[0].sources.website, "overture");
  assert.equal(r.savedEarly, 1);
  assert.equal(r.unsaved.length, 0);
});

test("without a batch hook everything is left for the end, as before", async () => {
  const maps = batching("google_maps", [[lead("A", "081200000001", "google_maps")]]);
  const r = await collector(maps).collect({ ...base, sources: ["google_maps"], maxResults: 10 });
  assert.equal(r.savedEarly, 0);
  assert.equal(r.unsaved.length, 1);
});
