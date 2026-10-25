import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSourceLeads } from "./merge";
import type { RawSourceLead } from "./lead-source";

const lead = (over: Partial<RawSourceLead>): RawSourceLead => ({
  name: "Contoh Studio", address: "", phone: "", website: "", rating: "N/A", reviewCount: null, category: "", hasWebsite: false,
  referenceUrl: "", lat: null, lng: null, businessStatus: null, source: "google_maps", ...over,
});

test("a business found by two sources is one lead with the gaps filled in", () => {
  const maps = lead({ phone: "0812-0000-1111", rating: "4.6", lat: -6.2, lng: 106.8 });
  const osm = lead({ source: "osm", phone: "+62 812 0000 1111", website: "https://contoh.example.com", email: "halo@contoh.example.com", category: "camera" });
  const { leads, merged } = mergeSourceLeads([maps], [osm]);
  assert.equal(leads.length, 1);
  assert.equal(merged, 1);
  assert.equal(leads[0].source, "google_maps");
  assert.equal(leads[0].website, "https://contoh.example.com");
  assert.equal(leads[0].hasWebsite, true);
  assert.equal(leads[0].email, "halo@contoh.example.com");
  assert.deepEqual(leads[0].fieldSources, { website: "osm", email: "osm", category: "osm" });
});

test("the first source wins where both have a value", () => {
  const { leads } = mergeSourceLeads([lead({ phone: "081200001111", address: "Jl. Mawar 1" })], [lead({ source: "osm", phone: "+6281200001111", address: "Jl. Lain 9" })]);
  assert.equal(leads[0].address, "Jl. Mawar 1");
  assert.equal(leads[0].fieldSources, undefined);
});

test("different businesses stay separate, and a closed status is not lost", () => {
  const a = lead({ phone: "081200001111" });
  const b = lead({ name: "Toko Lain", source: "osm", phone: "081200002222" });
  assert.equal(mergeSourceLeads([a], [b]).leads.length, 2);
  const closed = lead({ source: "osm", phone: "+6281200001111", businessStatus: "permanently_closed" });
  assert.equal(mergeSourceLeads([lead({ phone: "081200001111" })], [closed]).leads[0].businessStatus, "permanently_closed");
});

test("two records inside the incoming list are merged too", () => {
  const { leads } = mergeSourceLeads([], [lead({ source: "osm", phone: "081200001111" }), lead({ source: "osm", name: "Nama Lain", phone: "+6281200001111", website: "https://x.example.com" })]);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].website, "https://x.example.com");
});

test("a profile page found by the second source is kept", () => {
  const a = lead({ phone: "081200001111" });
  const b = lead({ source: "osm", phone: "+6281200001111", social: { instagram: "https://www.instagram.com/contoh/" } });
  const { leads } = mergeSourceLeads([a], [b]);
  assert.deepEqual(leads[0].social, { instagram: "https://www.instagram.com/contoh/" });
  assert.equal(leads[0].fieldSources?.instagram, "osm");
});

test("branches that share a website but have their own numbers stay separate leads", () => {
  const branch = (name: string, phone: string): RawSourceLead => lead({ name, phone, website: "http://www.kfcku.com/", source: "overture" });
  const { leads, merged } = mergeSourceLeads([], [branch("KFC A", "+62226645586"), branch("KFC B", "+628117157173"), branch("KFC C", "+628117157188")]);
  assert.equal(leads.length, 3);
  assert.equal(merged, 0);
});
