import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigService } from "@nestjs/config";
import { parseOsmQuery, safePhrase } from "./osm-tags";
import { bboxFromNominatim, buildOverpassQuery, elementToLead, leadsFromOverpass } from "./osm-overpass";
import { OsmSource } from "./osm.source";

test("a tag typed as key=value is used as it is", () => {
  assert.deepEqual(parseOsmQuery("shop=camera"), [{ tag: ["shop", "camera"] }]);
  assert.deepEqual(parseOsmQuery(" Amenity = Cafe "), [{ tag: ["amenity", "cafe"] }]);
  assert.deepEqual(parseOsmQuery("contact:phone=yes"), [{ tag: ["contact:phone", "yes"] }]);
});

test("business types are known by their Indonesian and English names", () => {
  assert.deepEqual(parseOsmQuery("Toko Kamera"), [{ tag: ["shop", "camera"] }]);
  assert.ok(parseOsmQuery("restoran padang").some((x) => x.tag?.join("=") === "amenity=restaurant"));
  assert.ok(parseOsmQuery("klinik gigi").some((x) => x.tag?.join("=") === "amenity=dentist"));
  assert.ok(!parseOsmQuery("klinik gigi").some((x) => x.tag?.join("=") === "amenity=restaurant"));
});

test("an unknown type is searched by name, and only then", () => {
  assert.deepEqual(parseOsmQuery("jasa konsultan drone"), [{ name: "jasa konsultan drone" }]);
  assert.deepEqual(parseOsmQuery("a"), []);
});

test("nothing typed can break out of the query", () => {
  const hostile = 'x"]; out; (node(1); //"\\ ${evil}';
  assert.equal(/["\;(){}$\/]/.test(safePhrase(hostile)), false);
  const q = buildOverpassQuery(parseOsmQuery(hostile), { south: -7, west: 107, north: -6, east: 108 }, 10);
  assert.equal(q.split("\n").filter((l) => l.startsWith("  nwr")).length, parseOsmQuery(hostile).length);
  for (const line of q.split("\n").filter((l) => l.startsWith("  nwr"))) assert.match(line, /^  nwr\["name"~"[A-Za-z0-9 .]+",i\]\[~"\^\(shop\|amenity\|craft\|office\|tourism\|leisure\|healthcare\)\$"~"\."\]\[~"\^\(phone[^"]*\)\$"~"\."\]\(.*\);$/);
  assert.throws(() => buildOverpassQuery([{ tag: ['a"b', "c"] }], { south: 0, west: 0, north: 1, east: 1 }, 5), /No usable/);
});

test("the Overpass query asks for named places in the box, capped", () => {
  const q = buildOverpassQuery([{ tag: ["shop", "camera"] }, { name: "Foto Kita" }], { south: -7.0, west: 107.5, north: -6.8, east: 107.7 }, 30);
  assert.match(q, /^\[out:json\]\[timeout:60\];/);
  assert.match(q, /nwr\["shop"="camera"\]\["name"\]\[~"\^\(phone\|contact:phone\|mobile.*contact:facebook\)\$"~"\."\]\(-7,107\.5,-6\.8,107\.7\);/);
  assert.doesNotMatch(buildOverpassQuery([{ tag: ["shop", "camera"] }], { south: 0, west: 0, north: 1, east: 1 }, 5, 60, false), /phone/);
  assert.match(q, /out center tags 30;$/);
  assert.match(buildOverpassQuery([{ tag: ["shop", "camera"] }], { south: 0, west: 0, north: 1, east: 1 }, 99999), /out center tags 1000;$/);
});

test("an element becomes a lead with only the details it really has", () => {
  const lead = elementToLead({
    type: "node", id: 42, lat: -6.9, lon: 107.6,
    tags: { name: "Contoh Kamera", shop: "camera", phone: "+62 812-0000-1111; +62 22 555 000", "contact:website": "contoh.example.com", email: "Halo@Contoh.Example.com", "addr:street": "Jl. Mawar", "addr:housenumber": "5", "addr:city": "Bandung" },
  });
  assert.ok(lead);
  assert.equal(lead.name, "Contoh Kamera");
  assert.equal(lead.phone, "+62 812-0000-1111");
  assert.equal(lead.website, "https://contoh.example.com/");
  assert.equal(lead.hasWebsite, true);
  assert.equal(lead.email, "halo@contoh.example.com");
  assert.equal(lead.address, "Jl. Mawar 5, Bandung");
  assert.equal(lead.category, "camera");
  assert.equal(lead.referenceUrl, "https://www.openstreetmap.org/node/42");
  assert.equal(lead.source, "osm");
  assert.equal(lead.rating, "N/A");
});

test("places without a name, closed down, or with unusable contact data are handled", () => {
  assert.equal(elementToLead({ type: "node", id: 1, lat: 0, lon: 0, tags: { shop: "camera" } }), null);
  assert.equal(elementToLead({ type: "node", id: 2, lat: 0, lon: 0, tags: { name: "Tutup", "disused:shop": "camera" } }), null);
  assert.equal(elementToLead({ type: "way", id: 3, center: { lat: 1, lon: 2 }, tags: { name: "Aneh", shop: "bakery", phone: "abc", website: "javascript:alert(1)", email: "bukan email" } }), null);
  assert.equal(elementToLead({ type: "node", id: 4, lat: 0, lon: 0, tags: { name: "Tanpa Kontak", shop: "bakery" } }), null);
  const partial = elementToLead({ type: "way", id: 5, center: { lat: 1, lon: 2 }, tags: { name: "Sebagian", shop: "bakery", phone: "abc", email: "halo@sebagian.example.com" } });
  assert.ok(partial);
  assert.equal(partial.phone, "");
  assert.equal(partial.email, "halo@sebagian.example.com");
  assert.equal(partial.lat, 1);
  assert.equal(partial.lng, 2);
});

test("an Overpass answer of any shape gives leads or nothing, never an error", () => {
  const body = { elements: [{ type: "node", id: 1, lat: 1, lon: 2, tags: { name: "A", shop: "bakery", phone: "+6281200001111" } }, { type: "node", id: 1, lat: 1, lon: 2, tags: { name: "A", shop: "bakery", phone: "+6281200001111" } }, { type: "x" }, null, { type: "node", id: 2, tags: { name: "B", shop: "bakery", phone: "+6281200002222" } }] };
  assert.equal(leadsFromOverpass(body).length, 2);
  assert.equal(leadsFromOverpass(body, "", 1).length, 1);
  for (const junk of [null, undefined, 5, "x", {}, { elements: "no" }, []]) assert.deepEqual(leadsFromOverpass(junk), []);
});

test("Nominatim boxes are read and bad ones refused", () => {
  assert.deepEqual(bboxFromNominatim([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]), { south: -7.1, west: 107.5, north: -6.8, east: 107.8 });
  for (const bad of [[], null, [{}], [{ boundingbox: ["a", "b", "c", "d"] }], [{ boundingbox: ["5", "1", "1", "2"] }], [{ boundingbox: ["0", "1", "0", "200"] }]]) assert.equal(bboxFromNominatim(bad), null);
});

function source(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, env: Record<string, string> = {}) {
  const s = new OsmSource(new ConfigService(env));
  const calls: string[] = [];
  s.fetchFn = (async (url: string | URL | Request, init?: RequestInit) => { calls.push(String(url)); return handler(String(url), init); }) as typeof fetch;
  return { s, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const req = { searchQueries: ["toko kamera"], location: "Bandung", industry: "x", maxResults: 5 };

test("the source finds the place, then asks Overpass once and returns the leads", async () => {
  const { s, calls } = source((url, init) => {
    if (url.includes("/search?")) return json([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]);
    assert.match(String(init?.body), /shop.*camera/);
    assert.equal((init?.headers as Record<string, string>)["User-Agent"].length > 5, true);
    return json({ elements: [{ type: "node", id: 9, lat: -6.9, lon: 107.6, tags: { name: "Contoh Kamera", shop: "camera", phone: "+6281200001111" } }] });
  });
  const leads = await s.search(req);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].source, "osm");
  assert.equal(calls.length, 2);
});

test("failures say what to do", async () => {
  await assert.rejects(source(() => json([]), { OVERPASS_DISABLED: "true" }).s.search(req), /switched off/);
  await assert.rejects(source(() => json([]), { GEOCODER_DISABLED: "true" }).s.search(req), /GEOCODER_DISABLED/);
  await assert.rejects(source(() => json([])).s.search(req), /could not find "Bandung"/);
  await assert.rejects(source((url) => (url.includes("/search?") ? json([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]) : new Response("", { status: 500 }))).s.search(req), /Overpass answered 500/);
  await assert.rejects(source((url) => (url.includes("/search?") ? json([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]) : new Response("<html>busy</html>", { status: 200 }))).s.search(req), /not JSON/);
  await assert.rejects(source((url) => (url.includes("/search?") ? json([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]) : json({ elements: [], remark: "runtime error: Query timed out" }))).s.search(req), /timed out/);
  await assert.rejects(source(() => json([])).s.search({ ...req, searchQueries: ["a"] }), /None of the search terms/);
});

test("a place with no matches is an empty result, not an error", async () => {
  const { s } = source((url) => (url.includes("/search?") ? json([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]) : json({ elements: [] })));
  assert.deepEqual(await s.search(req), []);
});

test("an Instagram or Facebook page listed on a place is kept as a way to read about it", async () => {
  const { profileUrl } = await import("./osm-overpass");
  assert.equal(profileUrl("instagram", "@contoh.kopi"), "https://www.instagram.com/contoh.kopi/");
  assert.equal(profileUrl("instagram", "https://www.instagram.com/contoh.kopi/"), "https://www.instagram.com/contoh.kopi/");
  assert.equal(profileUrl("facebook", "ContohBengkel"), "https://www.facebook.com/ContohBengkel");
  assert.equal(profileUrl("facebook", "https://fb.com/contoh"), "https://fb.com/contoh");
  for (const bad of ["https://evil.example.com/contoh", "javascript:alert(1)", "a b c", "x".repeat(300), "", undefined]) assert.equal(profileUrl("instagram", bad as string), null);
  assert.equal(profileUrl("instagram", "https://facebook.com/contoh"), null);
  const lead = elementToLead({ type: "node", id: 7, lat: 1, lon: 2, tags: { name: "Hanya Instagram", shop: "bakery", "contact:instagram": "roti.contoh" } });
  assert.ok(lead);
  assert.equal(lead.phone, "");
  assert.deepEqual(lead.social, { instagram: "https://www.instagram.com/roti.contoh/" });
  assert.equal(elementToLead({ type: "node", id: 8, lat: 1, lon: 2, tags: { name: "Instagram Palsu", shop: "bakery", instagram: "https://evil.example.com/x" } }), null);
});
