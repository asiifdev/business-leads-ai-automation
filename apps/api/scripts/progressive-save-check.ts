/**
 * Checks, against a real database, what progressive saving and branches rely on: ids returned for stored leads, a branch kept as its own
 * lead and marked (not a repeat), a repeat at the same place still marked, a run that starts again not saving twice, and a later source's
 * details written only where the stored value is empty.
 * Run: DATABASE_URL=<a scratch database> npx tsx scripts/progressive-save-check.ts
 * Everything happens in a throwaway workspace that is deleted at the end; no AI, no network.
 */
import { PrismaService } from "../src/prisma/prisma.service";
import { LeadsService } from "../src/leads/leads.service";
import { leadKey } from "../src/scraper/lead-key";

const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

async function main() {
  await prisma.$connect();
  const stamp = Date.now().toString(36);
  const ws = (await prisma.workspace.create({ data: { name: `ps-check ${stamp}`, slug: `ps-check-${stamp}` } })).id;
  try {
    const camp = await prisma.campaign.create({ data: { name: "one", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId: ws } });
    const leads = new LeadsService(prisma);
    const base = { workspaceId: ws, campaignId: camp.id, source: "google_maps" };
    const chain = { phone: "0812-5000-0001", website: "https://contoh-mart.example.com" };

    // 1. a batch returns the stored ids in order
    const first = await leads.createMany([
      { ...base, name: "Contoh Mart Jakarta", address: "Jl. Mawar 1, Jakarta", lat: -6.2, lng: 106.8, ...chain },
      { ...base, name: "Toko Lain", address: "Jl. Melati 2", lat: -6.21, lng: 106.81, phone: "0812-5000-0002" },
    ]);
    check("a batch returns one stored id per lead, in order", first.ids.length === 2 && first.count === 2);
    const jakarta = await prisma.lead.findUniqueOrThrow({ where: { id: first.ids[0] } });
    check("the id matches the stored lead", jakarta.name === "Contoh Mart Jakarta");

    // 2. the same number at a clearly different place: its own lead, marked as a branch, not a repeat
    const second = await leads.createMany([
      { ...base, name: "Contoh Mart Bandung", address: "Jl. Asia Afrika 5, Bandung", lat: -6.92, lng: 107.6, ...chain },
      { ...base, name: "Contoh Mart Jakarta", address: "Jl. Mawar 1, Jakarta", lat: -6.2002, lng: 106.8001, ...chain }, // the same listing again
    ]);
    const bandung = await prisma.lead.findUniqueOrThrow({ where: { id: second.ids[0] } });
    const again = await prisma.lead.findUniqueOrThrow({ where: { id: second.ids[1] } });
    check("another outlet is kept as its own lead and marked as a branch", bandung.branchOfId === jakarta.id && bandung.duplicateOfId === null);
    check("a branch is not rated down for being a branch", bandung.dataQuality === "high" && bandung.qualityIssues.includes("branch"), `${bandung.dataQuality} ${bandung.qualityIssues.join(",")}`);
    check("the same listing at the same place is still a repeat", again.duplicateOfId === jakarta.id && again.branchOfId === null && again.dataQuality === "low");

    // 3. a run that starts again does not save the same leads twice
    const keys = await leads.campaignLeadKeys(camp.id);
    check("the campaign's stored leads are known by key, with their id", keys.get(leadKey({ name: "Contoh Mart Jakarta", address: "Jl. Mawar 1, Jakarta", phone: "0812-5000-0001" })) !== undefined && keys.size >= 3);
    check("a branch has a key of its own", keys.has(leadKey({ name: "Contoh Mart Bandung", address: "Jl. Asia Afrika 5, Bandung", phone: "0812-5000-0001" })));

    // 4. a later source fills only what is empty, and says where it came from
    const fill = await leads.applyFills([{
      id: first.ids[1],
      values: { phone: "0812-9999-9999", website: "https://toko-lain.example.com", email: "halo@toko-lain.example.com", category: "Toko" },
      sources: { website: "overture", email: "overture", category: "overture" },
      social: { instagram: "https://instagram.com/toko_lain" },
    }]);
    const filled = await prisma.lead.findUniqueOrThrow({ where: { id: first.ids[1] } });
    const meta = filled.fieldMeta as Record<string, { source: string }>;
    check("an empty website, email and category are filled", filled.website === "https://toko-lain.example.com" && filled.email === "halo@toko-lain.example.com" && filled.category === "Toko" && filled.hasWebsite === true && fill.filled === 1);
    check("a phone that was already there is never replaced", filled.phone === "0812-5000-0002" && filled.phoneE164 !== null && !String(filled.phoneE164).endsWith("99999999"));
    check("the source of each filled field is recorded", meta.website?.source === "overture" && meta.email?.source === "overture" && meta.phone?.source === "google_maps");
    check("a social profile is kept for enrichment", (filled.enrichment as { social?: Record<string, string> } | null)?.social?.instagram === "https://instagram.com/toko_lain");
    const none = await leads.applyFills([{ id: first.ids[1], values: { website: "https://other.example.com" }, sources: { website: "osm" } }]);
    check("filling again changes nothing", none.filled === 0 && (await prisma.lead.findUniqueOrThrow({ where: { id: first.ids[1] } })).website === "https://toko-lain.example.com");

    // 5. recompute keeps branches as branches
    await leads.recomputeQuality(ws);
    const after = await prisma.lead.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "asc" } });
    const byName = (n: string, i = 0) => after.filter((l) => l.name === n)[i];
    check("a recompute keeps the branch a branch", byName("Contoh Mart Bandung").branchOfId !== null && byName("Contoh Mart Bandung").duplicateOfId === null);
    check("a recompute keeps the repeat a repeat", after.filter((l) => l.name === "Contoh Mart Jakarta" && l.duplicateOfId).length === 1);
  } finally {
    await prisma.workspace.delete({ where: { id: ws } }).catch(() => undefined);
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
