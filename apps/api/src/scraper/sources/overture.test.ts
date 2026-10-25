import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigService } from "@nestjs/config";
import { overtureFilters, parseOvertureQuery } from "./overture-categories";
import { assertSafeDataset, buildPlacesQuery, leadsFromRows, overtureRowToLead } from "./overture-query";
import { OvertureSource } from "./overture.source";

const box = { south: -7, west: 107.5, north: -6.8, east: 107.7 };
const DATASET = "s3://overturemaps-us-west-2/release/2026-10-21.0/theme=places/type=place/*";

test("business types map to Overture category pieces, in Indonesian and English", () => {
  assert.deepEqual(parseOvertureQuery("toko kamera"), { stems: ["camera"] });
  assert.ok(parseOvertureQuery("restoran padang").stems.includes("restaurant"));
  assert.deepEqual(parseOvertureQuery("Dokter Gigi").stems, ["dental", "dentist"]);
  assert.deepEqual(parseOvertureQuery("category=camera_store"), { stems: ["camera_store"] });
});

test("an unknown type is searched by name; a word too short is nothing", () => {
  assert.deepEqual(parseOvertureQuery("jasa konsultan drone"), { stems: [], name: "jasa konsultan drone" });
  assert.deepEqual(parseOvertureQuery("a"), { stems: [] });
  const f = overtureFilters(["toko kamera", "restoran", "jasa drone", "toko kamera"]);
  assert.deepEqual(f.names, ["jasa drone"]);
  assert.ok(f.stems.includes("camera") && f.stems.includes("restaurant"));
});

test("the query binds every value and writes nothing typed by a person into the text", () => {
  const hostile = "x') OR 1=1; DROP TABLE a; -- 100%_";
  const f = overtureFilters(["category=camera_store", hostile]);
  const q = buildPlacesQuery({ dataset: DATASET, box, stems: f.stems, names: f.names, minConfidence: 0.25, limit: 30 });
  assert.equal((q.sql.match(/\?/g) ?? []).length, q.values.length);
  assert.ok(!q.sql.includes("DROP") && !q.sql.includes("OR 1=1") && !q.sql.includes("camera_store"));
  assert.deepEqual(q.values.slice(0, 5), [107.5, 107.7, -7, -6.8, 0.25]);
  assert.equal(q.values.at(-1), 30);
  assert.match(q.sql, /ILIKE \? ESCAPE '\\'/);
  assert.match(q.sql, /bbox AS box/);
  assert.ok(!/bbox\.\w+ AS/.test(q.sql), "a struct field filtered on must not also be selected as a column");
  assert.match(buildPlacesQuery({ dataset: DATASET, box, stems: [], names: ["100%_x"], minConfidence: 0, limit: 5 }).values.join("|"), /%100\\%\\_x%/);
  assert.equal(buildPlacesQuery({ dataset: DATASET, box, stems: ["a_b"], names: [], minConfidence: 0, limit: 99999 }).values.at(-1), 5000);
  assert.throws(() => buildPlacesQuery({ dataset: DATASET, box, stems: [], names: [], minConfidence: 0, limit: 5 }), /No usable/);
});

test("only dataset addresses of a known shape are written into the query", () => {
  assert.equal(assertSafeDataset(DATASET), DATASET);
  assert.equal(assertSafeDataset("/data/overture/places/*.parquet"), "/data/overture/places/*.parquet");
  for (const bad of ["s3://b/x'); DROP TABLE a; --", "http://insecure.example.com/x", "../etc/passwd", "/data/../etc/x", "", "s3://b/ spaced", "file:///etc/passwd"]) assert.throws(() => assertSafeDataset(bad), /not a valid dataset/);
});

const row = { id: "a1", name: "D'Plate Resto", category: "indonesian_restaurant", status: null, phones: ["+62225423334", "+6281234567890"], websites: ["javascript:x", "https://dplate.example.com"], emails: ["BAD", "Halo@Dplate.Example.com"], socials: ["https://www.facebook.com/170547010304728", "https://evil.example.com/x"], address: "Jl. Taman Kopo 4", city: "Bandung", region: "Jawa Barat", box: { xmin: "107.56", xmax: 107.56, ymin: -6.95, ymax: -6.95 } };

test("a place becomes a lead with the mobile number first and only usable details", () => {
  const l = overtureRowToLead(row, "restoran");
  assert.ok(l);
  assert.equal(l.phone, "+6281234567890");
  assert.equal(l.website, "https://dplate.example.com");
  assert.equal(l.email, "halo@dplate.example.com");
  assert.deepEqual(l.social, { facebook: "https://www.facebook.com/170547010304728" });
  assert.equal(l.category, "indonesian restaurant");
  assert.equal(l.lng, 107.56);
  assert.equal(l.source, "overture");
  assert.equal(l.businessStatus, null);
});

test("closed places are marked, and places without a name or any way in are dropped", () => {
  assert.equal(overtureRowToLead({ ...row, status: "closed" })?.businessStatus, "permanently_closed");
  assert.equal(overtureRowToLead({ ...row, status: "temporarily_closed" })?.businessStatus, "temporarily_closed");
  assert.equal(overtureRowToLead({ ...row, name: "  " }), null);
  assert.equal(overtureRowToLead({ id: "x", name: "Tanpa Kontak", phones: ["abc"], websites: [], emails: null, socials: ["https://evil.example.com/x"] }), null);
  const onlyFb = overtureRowToLead({ id: "y", name: "Hanya Facebook", socials: ["https://www.facebook.com/123456789"] });
  assert.ok(onlyFb);
  assert.equal(onlyFb.phone, "");
  assert.equal(leadsFromRows([row, row, { ...row, id: "a2" }]).length, 2);
  assert.equal(leadsFromRows([row, { ...row, id: "a2" }], "", 1).length, 1);
  assert.deepEqual(leadsFromRows([null as never, "x" as never, 5 as never].filter(Boolean) as never), []);
});

function source(env: Record<string, string>, run: (sql: string, values: (string | number)[]) => Promise<Record<string, unknown>[]>, fetched: string[] = []) {
  const s = new OvertureSource(new ConfigService(env));
  s.run = run;
  s.fetchFn = (async (url: string | URL | Request) => {
    fetched.push(String(url));
    if (String(url).includes("stac.")) return new Response(JSON.stringify({ latest: "2026-10-21.0" }), { status: 200 });
    return new Response(JSON.stringify([{ boundingbox: ["-7.1", "-6.8", "107.5", "107.8"] }]), { status: 200 });
  }) as typeof fetch;
  return s;
}
const req = { searchQueries: ["restoran"], location: "Bandung", industry: "x", maxResults: 5 };

test("the source finds the box, queries the latest release once and returns leads", async () => {
  const ran: { sql: string; values: (string | number)[] }[] = [];
  const fetched: string[] = [];
  const s = source({}, async (sql, values) => { ran.push({ sql, values }); return [row]; }, fetched);
  const leads = await s.search(req);
  assert.equal(leads.length, 1);
  assert.equal(ran.length, 1);
  assert.match(ran[0].sql, /release\/2026-10-21\.0\/theme=places/);
  assert.ok(fetched.some((u) => u.includes("stac.overturemaps.org")) && fetched.some((u) => u.includes("/search?")));
  assert.equal(await s.dataset(), DATASET);
});

test("a dataset can be pinned, or pointed at a local copy", async () => {
  assert.equal(await source({ OVERTURE_RELEASE: "2026-09-17.0" }, async () => []).dataset(), "s3://overturemaps-us-west-2/release/2026-09-17.0/theme=places/type=place/*");
  assert.equal(await source({ OVERTURE_PLACES_URL: "/data/places/*.parquet" }, async () => []).dataset(), "/data/places/*.parquet");
  await assert.rejects(source({ OVERTURE_RELEASE: "latest; DROP" }, async () => []).dataset(), /must look like/);
});

test("failures say what to do, and a place with no matches is an empty result", async () => {
  await assert.rejects(source({ OVERTURE_DISABLED: "true" }, async () => []).search(req), /switched off/);
  await assert.rejects(source({ GEOCODER_DISABLED: "true" }, async () => []).search(req), /GEOCODER_DISABLED/);
  await assert.rejects(source({}, async () => []).search({ ...req, searchQueries: ["a"] }), /None of the search terms/);
  await assert.rejects(source({}, async () => { throw new Error("S3 said no"); }).search(req), /Overture Maps: S3 said no/);
  assert.deepEqual(await source({}, async () => []).search(req), []);
});
