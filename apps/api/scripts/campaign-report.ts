/**
 * Read-only report on one campaign's leads: repeats, relevance, contact details and where the leads are.
 * Run: DATABASE_URL=... npx tsx scripts/campaign-report.ts <campaignId> [--terms "kata1,kata2"] [--show 15]
 * Nothing is written. It prints counts and a short list of the least relevant names so a person can judge; it does not decide relevance
 * by itself. `--terms` are words that mean "relevant" for this campaign (default: the campaign's own search queries, split into words).
 */
import { PrismaService } from "../src/prisma/prisma.service";
import { distanceM, nameKey, websiteDomain } from "../src/leads/dedupe";
import { normalizePhone } from "../src/messaging/phone";
import { splitAreas } from "../src/scraper/areas";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const campaignId = args.find((a) => !a.startsWith("--") && a !== flag("--terms") && a !== flag("--show"));
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");

async function main() {
  if (!campaignId) throw new Error("usage: campaign-report.ts <campaignId> [--terms a,b] [--show 15]");
  const prisma = new PrismaService();
  const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!c) throw new Error("campaign not found");
  const leads = await prisma.lead.findMany({ where: { campaignId, source: { not: "fixture" } }, select: { id: true, name: true, category: true, address: true, phone: true, phoneE164: true, email: true, website: true, hasWebsite: true, lat: true, lng: true, province: true, regency: true, source: true, duplicateOfId: true, businessStatus: true, enrichment: true } });
  const n = leads.length;
  console.log(`Campaign: ${c.name} | status ${c.status} ${c.progress}% | asked ${c.maxResults} | stored ${n} | country ${c.country} | location "${c.location}" | sources ${(c.sources ?? []).join(",")}`);
  if (!n) { console.log("No leads stored yet. Leads are saved when all searches of all sources are finished."); await prisma.$disconnect(); return; }

  // 1. Repeats
  const byPhone = new Map<string, number>(); const byDomain = new Map<string, number>(); const byName = new Map<string, number>();
  for (const l of leads) {
    const p = l.phoneE164 || normalizePhone(l.phone); if (p) byPhone.set(p, (byPhone.get(p) ?? 0) + 1);
    const d = websiteDomain(l.website); if (d) byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
    const k = nameKey(l.name); if (k.length >= 4) byName.set(k, (byName.get(k) ?? 0) + 1);
  }
  const rep = (m: Map<string, number>) => [...m.values()].filter((v) => v > 1).reduce((a, v) => a + v - 1, 0);
  console.log(`\n1. REPEATS\n  flagged as repeat of another lead: ${leads.filter((l) => l.duplicateOfId).length}\n  extra rows sharing a phone number: ${rep(byPhone)} | a website domain: ${rep(byDomain)} | the same name (may be real branches): ${rep(byName)}`);
  console.log(`  by source: ${Object.entries(leads.reduce<Record<string, number>>((a, l) => ((a[l.source] = (a[l.source] ?? 0) + 1), a), {})).map(([s, v]) => `${s} ${v}`).join(", ")}`);

  // 2. Relevance (words only: a person must read the sample)
  const terms = (flag("--terms") ?? c.searchQueries.join(" ")).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !["toko", "jual", "beli", "shop", "store"].includes(w));
  const hit = (l: { name: string; category: string | null }) => { const t = `${l.name} ${l.category ?? ""}`.toLowerCase(); return terms.some((w) => t.includes(w)); };
  const matched = leads.filter(hit);
  const cats = new Map<string, number>(); for (const l of leads) { const k = (l.category ?? "(none)").toLowerCase(); cats.set(k, (cats.get(k) ?? 0) + 1); }
  console.log(`\n2. RELEVANCE (name or category contains one of: ${[...new Set(terms)].slice(0, 25).join(", ")})\n  match: ${matched.length}/${n} = ${pct(matched.length, n)}; closed or temporarily closed: ${leads.filter((l) => l.businessStatus).length}\n  top categories: ${[...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join("; ")}`);
  const show = Number(flag("--show") ?? 15);
  const odd = leads.filter((l) => !hit(l)).slice(0, show);
  if (odd.length) console.log(`  sample with no match (judge these by eye):\n${odd.map((l) => `    - ${l.name} [${l.category ?? "no category"}]`).join("\n")}`);

  // 3. Contact details
  const has = (f: (l: (typeof leads)[number]) => boolean) => leads.filter(f).length;
  const social = (l: (typeof leads)[number]) => { const s = (l.enrichment as { social?: Record<string, unknown>; emails?: unknown[] } | null)?.social; return !!s && Object.values(s).some(Boolean); };
  console.log(`\n3. CONTACT DETAILS (of ${n})\n  phone ${pct(has((l) => !!l.phoneE164), n)} | website ${pct(has((l) => l.hasWebsite), n)} | email ${pct(has((l) => !!l.email), n)} | social profile ${pct(has(social), n)}\n  phone or email (reachable): ${pct(has((l) => !!l.phoneE164 || !!l.email), n)} | none of phone, website, email: ${pct(has((l) => !l.phoneE164 && !l.hasWebsite && !l.email), n)}`);

  // 4. Geography
  const placed = leads.filter((l) => typeof l.lat === "number" && typeof l.lng === "number");
  const areas = splitAreas(c.location);
  const regs = new Map<string, number>(); for (const l of leads) { const k = l.regency || l.province || "(unknown)"; regs.set(k, (regs.get(k) ?? 0) + 1); }
  console.log(`\n4. GEOGRAPHY\n  with coordinates ${pct(placed.length, n)}; places asked: ${areas.length ? areas.join(", ") : c.location}\n  where they are: ${[...regs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} ${v}`).join("; ")}`);
  if (placed.length > 1) {
    const cx = placed.reduce((a, l) => a + l.lat!, 0) / placed.length, cy = placed.reduce((a, l) => a + l.lng!, 0) / placed.length;
    const far = placed.filter((l) => distanceM({ lat: cx, lng: cy }, { lat: l.lat!, lng: l.lng! }) > 1_500_000).length;
    console.log(`  spread: ${far} leads are more than 1,500 km from the centre of the set (expected only for a country-wide campaign)`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
