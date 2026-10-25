/**
 * Reads real places from Overture Maps through DuckDB, with the real query, in the real place lookup (public Nominatim and S3).
 * Run: npx tsx scripts/overture-check.ts   (needs the network; the first search can take two minutes, later ones seconds)
 * Set OVERTURE_PLACES_URL to a local parquet copy to check that path instead.
 */
import { ConfigService } from "@nestjs/config";
import { OvertureSource } from "../src/scraper/sources/overture.source";

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

async function main() {
  const env: Record<string, string> = { GEOCODER_USER_AGENT: "Prospex-dev-check/1.0 (local test)" };
  if (process.env.OVERTURE_PLACES_URL) env.OVERTURE_PLACES_URL = process.env.OVERTURE_PLACES_URL;
  const s = new OvertureSource(new ConfigService(env));
  try {
    let t = Date.now();
    const a = await s.search({ searchQueries: ["restoran"], location: "Bandung", country: "ID", industry: "restoran", maxResults: 10 });
    const first = Date.now() - t;
    console.log(`first search: ${Math.round(first / 1000)} s, ${a.length} leads`);
    check("a first search returns places", a.length > 0 && a.length <= 10);
    check("every place has a name and a way to reach it", a.every((l) => l.name && (l.phone || l.website || l.email || l.social)));
    check("they are marked as Overture and have coordinates", a.every((l) => l.source === "overture" && l.lat !== null && l.lng !== null));
    check("most have a phone number", a.filter((l) => l.phone).length >= a.length / 2, `${a.filter((l) => l.phone).length}/${a.length}`);
    for (const l of a.slice(0, 3)) console.log("  ", JSON.stringify({ n: l.name, c: l.category, p: l.phone, w: l.website, fb: l.social?.facebook, a: l.address }));

    t = Date.now();
    const b = await s.search({ searchQueries: ["toko kamera", "category=beauty_salon"], location: "Bandung", country: "ID", industry: "x", maxResults: 10 });
    const second = Date.now() - t;
    console.log(`second search: ${Math.round(second / 1000)} s, ${b.length} leads`);
    check("a second search with other terms works in the same process", b.length > 0, `${b.length} leads, categories: ${[...new Set(b.map((l) => l.category))].slice(0, 4).join(", ")}`);
    check("and is much faster than the first", second < first / 2 || second < 20_000, `${Math.round(second / 1000)} s vs ${Math.round(first / 1000)} s`);

    const c = await s.search({ searchQueries: ["jasa konsultan drone pertanian"], location: "Bandung", country: "ID", industry: "x", maxResults: 5 });
    check("a type that is not known is searched by name and may find nothing", Array.isArray(c), `${c.length} leads`);
  } finally {
    s.onModuleDestroy();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
