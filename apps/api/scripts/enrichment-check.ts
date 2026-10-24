/**
 * Checks reading a lead's website or Instagram/Facebook page against a real database, with stand-in pages (the real fetcher refuses
 * local addresses on purpose) and no browser. Run: DATABASE_URL=... npx tsx scripts/enrichment-check.ts
 * Add LIVE=true to also read one real public Instagram and Facebook page (needs the network).
 * Everything happens in a throwaway workspace that is deleted at the end.
 */
import { PrismaService } from "../src/prisma/prisma.service";
import { EnrichmentService } from "../src/leads/enrichment.service";
import type { PageRenderer } from "../src/marketing/page-renderer";
import type { FetchedResource } from "../src/marketing/url-fetch";

const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

const LD = JSON.stringify({
  "@context": "https://schema.org", "@type": "Restaurant", name: "Rumah Makan Contoh", description: "Masakan Padang sejak 1990.",
  telephone: "+62 812-3456-7001", email: "halo@rm-contoh.co.id", address: { streetAddress: "Jl. Mawar 5", addressLocality: "Bandung" },
  openingHours: ["Mo-Su 08:00-21:00"], priceRange: "$$",
});
const PAGES: Record<string, string> = {
  "https://rm-contoh.co.id/": `<html><head><title>RM Contoh</title><meta name="description" content="Rumah makan"><script type="application/ld+json">${LD}</script></head><body><a href="/kontak">Kontak</a><p>Instagram: https://instagram.com/rmcontoh</p></body></html>`,
  "https://rm-contoh.co.id/kontak": "<html><body><p>Hubungi kami: pesan@rm-contoh.co.id</p></body></html>",
  "https://www.instagram.com/kopi.contoh/": `<head><meta property="og:title" content="Kopi Contoh (&#064;kopi.contoh) &#x2022; Instagram photos and videos" /><meta content="900 Followers, 10 Following, 80 Posts - Kopi Contoh (&#064;kopi.contoh) on Instagram: &quot;Kopi susu &amp; roti. Pesan WA 0812-3456-7002 atau pesan@kopi-contoh.co.id&quot;" name="description" /></head>`,
  "https://www.facebook.com/BengkelContoh": `<head><meta property="og:title" content="Bengkel Contoh" /><meta property="og:description" content="Bengkel Contoh. 1.200 pengikut &#xb7; 35 membicarakan ini. Servis motor dan mobil. WA 0812 3456 7003" /></head>`,
  "https://template.co.id/": `<head><script type="application/ld+json">{"@type":"LocalBusiness","telephone":"+62 812-3456-7009","email":"info@example.com"}</script></head>`,
  "https://www.instagram.com/tertutup/": '<head><meta property="og:title" content="Instagram" /><meta name="description" content="Create an account or log in to Instagram" /></head>',
};
let requests: string[] = [];
const stub = (async (url: string): Promise<FetchedResource> => {
  requests.push(url);
  const body = PAGES[url];
  if (body === undefined) throw new Error(`stand-in: no page for ${url}`);
  return { url, status: 200, type: "text/html", body, bytes: body.length } as unknown as FetchedResource;
}) as never;

async function main() {
  await prisma.$connect();
  const stamp = Date.now().toString(36);
  const ws = (await prisma.workspace.create({ data: { name: `enrich-check ${stamp}`, slug: `enrich-check-${stamp}` } })).id;
  const other = (await prisma.workspace.create({ data: { name: `enrich-other ${stamp}`, slug: `enrich-other-${stamp}` } })).id;
  try {
    const campaign = await prisma.campaign.create({ data: { name: "c", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId: ws } });
    const otherCampaign = await prisma.campaign.create({ data: { name: "c", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId: other } });
    const mk = (name: string, data: Record<string, unknown> = {}, w = ws, c = campaign.id) => prisma.lead.create({ data: { name, workspaceId: w, campaignId: c, source: "google_maps", ...data } as never });
    const svc = new EnrichmentService(prisma, { render: async () => { throw new Error("no browser in this check"); } } as unknown as PageRenderer);
    svc.fetchPage = stub;
    const get = (id: string) => prisma.lead.findUniqueOrThrow({ where: { id } });
    type Enr = { status: string; about?: { description?: string; type?: string; hours?: string; address?: string; priceRange?: string }; profile?: { platform: string; name: string }; social?: Record<string, string>; whatsapp?: string[]; emails?: string[] };
    const meta = (l: { fieldMeta: unknown }) => l.fieldMeta as Record<string, { source: string }> | null;

    // 1. a website: structured data gives the business details, and gaps are filled with their source
    const site = await mk("Rumah Makan Contoh", { website: "https://rm-contoh.co.id/" });
    const r1 = await svc.enrichLead(ws, site.id);
    const l1 = await get(site.id);
    const e1 = l1.enrichment as Enr;
    check("a website is read", r1.status === "enriched" && e1.status === "enriched");
    check("its description, type, hours, address and price are kept", e1.about?.description === "Masakan Padang sejak 1990." && e1.about?.type === "Restaurant" && e1.about?.hours === "Mo-Su 08:00-21:00" && e1.about?.address === "Jl. Mawar 5, Bandung" && e1.about?.priceRange === "$$", JSON.stringify(e1.about));
    check("an empty address is filled from the site, and says so", l1.address === "Jl. Mawar 5, Bandung" && meta(l1)?.address?.source === "website");
    check("an empty phone is filled with the mobile number the site states", l1.phoneE164 === "6281234567001" && meta(l1)?.phone?.source === "website");
    check("an e-mail printed on a contact page is found", e1.emails?.includes("pesan@rm-contoh.co.id") === true && !!l1.email, `${l1.email}`);
    check("the Instagram page printed on the site is remembered", e1.social?.instagram?.includes("instagram.com/rmcontoh") === true);
    check("the site is recorded as live", (l1.validation as { websiteLive?: boolean } | null)?.websiteLive === true);

    const tpl = await mk("Situs Template", { website: "https://template.co.id/" });
    await svc.enrichLead(ws, tpl.id);
    const lt = await get(tpl.id);
    check("a placeholder e-mail in structured data is not stored, a real number still is", !lt.email && lt.phoneE164 === "6281234567009", `${lt.email}`);

    // 2. what Google Maps gave is never replaced
    const keep = await mk("Sudah Punya", { website: "https://rm-contoh.co.id/", phone: "0899-0000-1111", phoneE164: "62899000011" + "11", address: "Alamat Maps", email: "maps@example.com" });
    await svc.enrichLead(ws, keep.id);
    const k = await get(keep.id);
    check("a phone, address and e-mail from the listing are not replaced", k.phone === "0899-0000-1111" && k.address === "Alamat Maps" && k.email === "maps@example.com");

    // 3. a profile given as the website
    const ig = await mk("Kopi Contoh", { website: "https://www.instagram.com/kopi.contoh/" });
    const r3 = await svc.enrichLead(ws, ig.id);
    const l3 = await get(ig.id);
    const e3 = l3.enrichment as Enr;
    check("an Instagram page is read from its public preview", r3.status === "enriched" && e3.profile?.platform === "instagram" && e3.profile?.name === "Kopi Contoh");
    check("the bio becomes the description", e3.about?.description === "Kopi susu & roti. Pesan WA 0812-3456-7002 atau pesan@kopi-contoh.co.id", e3.about?.description);
    check("the phone and e-mail written in the bio are found and fill the gaps", l3.phoneE164 === "6281234567002" && l3.email === "pesan@kopi-contoh.co.id" && meta(l3)?.phone?.source === "instagram", `${l3.phoneE164} ${l3.email}`);

    // 4. no website, but a Facebook page listed by the source
    const fb = await mk("Bengkel Contoh", { website: "", enrichment: { status: "from_source", social: { facebook: "https://www.facebook.com/BengkelContoh" } } });
    const r4 = await svc.enrichLead(ws, fb.id);
    const l4 = await get(fb.id);
    check("a lead with only a Facebook page is read from it", r4.status === "enriched" && l4.phoneE164 === "6281234567003" && (l4.enrichment as Enr).about?.description === "Servis motor dan mobil. WA 0812 3456 7003", `${l4.phoneE164}`);
    check("the profile stays remembered", (l4.enrichment as Enr).social?.facebook === "https://www.facebook.com/BengkelContoh");

    // 5. a login wall is reported, not guessed, and remembered
    const wall = await mk("Tertutup", { website: "https://www.instagram.com/tertutup/", phone: "0812-0000-5555", phoneE164: "628120000" + "5555" });
    const r5 = await svc.enrichLead(ws, wall.id);
    const l5 = await get(wall.id);
    check("a login page gives no details and is marked unreachable", r5.status === "unreachable" && (l5.enrichment as Enr).status === "unreachable" && !!l5.enrichedAt && !(l5.enrichment as Enr).about);
    check("the lead's own phone is untouched", l5.phone === "0812-0000-5555");

    // 6. nothing to read
    const nothing = await mk("Tanpa Apa-apa", { website: "" });
    check("a lead with no website and no page has nothing to read", (await svc.enrichLead(ws, nothing.id)).status === "no_website");
    const link = await mk("Hanya Linktree", { website: "https://linktr.ee/contoh" });
    check("a link-page is not read", (await svc.enrichLead(ws, link.id)).status === "no_website");

    // 7. refreshing old data across the workspace
    const old = new Date(Date.now() - 120 * 86_400_000);
    await prisma.lead.update({ where: { id: site.id }, data: { enrichedAt: old } });
    await prisma.lead.update({ where: { id: ig.id }, data: { enrichedAt: old } });
    const fixture = await mk("[Test data] x", { website: "https://rm-contoh.co.id/", source: "fixture" });
    const foreign = await mk("Milik Lain", { website: "https://rm-contoh.co.id/" }, other, otherCampaign.id);
    requests = [];
    const stale = await svc.enrichStale(ws);
    const siteNow = await get(site.id);
    check("old readings are read again, oldest first", stale.processed === 2 && siteNow.enrichedAt!.getTime() > old.getTime(), JSON.stringify(stale));
    check("nothing else is due afterwards", stale.remaining === 0 || stale.remaining === 3, `remaining ${stale.remaining}`);
    check("test data and other workspaces are left alone", (await get(fixture.id)).enrichedAt === null && (await get(foreign.id)).enrichedAt === null);
    const again = await svc.enrichStale(ws);
    check("a second call has nothing to do for those", again.processed <= 1, JSON.stringify(again));

    // 8. refreshing before drafting
    await prisma.lead.update({ where: { id: k.id }, data: { enrichedAt: old } });
    check("refreshIfDue reads an old lead and skips a fresh one", (await svc.refreshIfDue(ws, k.id)) === true && (await svc.refreshIfDue(ws, k.id)) === false);

    // 9. optional: the real pages
    if (process.env.LIVE === "true") {
      const live = new EnrichmentService(prisma, {} as PageRenderer);
      for (const [name, url, platform] of [["Live Instagram", "https://www.instagram.com/natgeo/", "instagram"], ["Live Facebook", "https://www.facebook.com/natgeo", "facebook"]] as const) {
        const l = await mk(name, { website: url });
        const r = await live.enrichLead(ws, l.id);
        const e = (await get(l.id)).enrichment as Enr;
        check(`${name}: the real public page is read`, r.status === "enriched" && e.profile?.platform === platform && !!e.about?.description, `${e.profile?.name} | ${e.about?.description?.slice(0, 60)}`);
      }
    }
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: [ws, other] } } });
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
