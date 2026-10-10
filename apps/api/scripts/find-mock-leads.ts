/**
 * Finds leads that were invented by the old "mock fallback" in the scraper (it created businesses such as
 * "Sewa Kamera Premier" with made-up phone numbers whenever scraping failed), and optionally marks them.
 *
 *   DATABASE_URL=... npx tsx scripts/find-mock-leads.ts          # list only
 *   DATABASE_URL=... npx tsx scripts/find-mock-leads.ts --mark   # set source = "suspected_mock" (excluded from drafts)
 *
 * The old generator made names "<q> Premier|Makmur|Berkah|Mandiri|Maju|Bersama|Sukses|Abadi", "Toko <q> Jaya" or
 * "Usaha <q> Sejahtera", an address "Jl. <area> No. 1x, <area>", a phone "+628" followed by 10000000 + n * 1234567,
 * no Google Maps link and no coordinates. A real Maps result always has a link, so the rule needs all of these signals.
 */
import { PrismaClient } from "@prisma/client";

const NAME = /(^Toko .+ Jaya$)|(^Usaha .+ Sejahtera$)|( (Premier|Makmur|Berkah|Mandiri|Maju|Bersama|Sukses|Abadi)$)/;
const GENERATED_PHONE = /^\\+?628(1\\d{7}|\\d{7})$/;

async function main() {
  const prisma = new PrismaClient();
  const leads = await prisma.lead.findMany({
    where: { source: "google_maps", lat: null, lng: null, OR: [{ referenceUrl: null }, { referenceUrl: "" }] },
    select: { id: true, name: true, address: true, phone: true, campaignId: true, workspaceId: true },
  });
  const suspects = leads.filter((l) => NAME.test(l.name) && /^Jl\\. .+ No\\. \\d+, /.test(l.address ?? "") && (!l.phone || GENERATED_PHONE.test(l.phone.replace(/[\\s-]/g, ""))));
  console.log(`${suspects.length} suspected invented lead(s) out of ${leads.length} without a Maps link`);
  for (const s of suspects.slice(0, 30)) console.log(`- ${s.name} | ${s.address} | ${s.phone ?? "-"} | campaign ${s.campaignId}`);
  if (process.argv.includes("--mark") && suspects.length) {
    const r = await prisma.lead.updateMany({ where: { id: { in: suspects.map((s) => s.id) } }, data: { source: "suspected_mock" } });
    console.log(`Marked ${r.count} lead(s) as suspected_mock. They are no longer used for drafts.`);
  } else if (suspects.length) {
    console.log("Run again with --mark to exclude them from drafts.");
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
