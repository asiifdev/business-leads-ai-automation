/**
 * Checks the data-trust rules against a real database, with a fake WhatsApp provider and stub writers.
 * Run: DATABASE_URL=... npx tsx scripts/data-quality-check.ts
 * Everything happens in a throwaway workspace that is deleted at the end; nothing is sent and no AI is called.
 * The e-mail domain check uses real DNS: when there is no network those lines say SKIP instead of failing.
 */
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { LeadsService } from "../src/leads/leads.service";
import { MessagingService } from "../src/messaging/messaging.service";
import { EmailService } from "../src/email/email.service";
import { checkEmailDomain } from "../src/leads/validation";
import type { RoutedWhatsappProvider } from "../src/messaging/whatsapp.provider";

const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
const skip = (name: string) => console.log(`SKIP  ${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Numbers ending in 9999 are not on WhatsApp. */
class FakeWa implements RoutedWhatsappProvider {
  lookups: string[] = [];
  use() {}
  hasCloud() { return false; }
  async connect() {}
  async disconnect() {}
  state() { return { status: "connected" as const, qr: null, phone: "62800000000" }; }
  async resolve(_w: string, phone: string) { this.lookups.push(phone); return phone.endsWith("9999") ? null : `${phone}@s.whatsapp.net`; }
  async send(): Promise<string> { throw new Error("this check must never send"); }
  onInbound() {}
}

const writer = {
  outreach: async () => ({ text: "Halo, ini draf uji.", risks: [] as string[], trace: { styled: false, examples: 0, knowledge: "none", model: "stub", latencyMs: 1 } }),
  subjectFor: async () => "Uji",
} as never;
const entitlements = { has: async () => false, edition: "community" } as never;
const noEnrichment = { refreshIfDue: async () => false } as never;

async function waitDone(get: () => { running: boolean } | null) {
  const end = Date.now() + 60_000;
  while (Date.now() < end) { if (!get()?.running) return; await sleep(200); }
}

async function main() {
  await prisma.$connect();
  const stamp = Date.now().toString(36);
  const ws = (await prisma.workspace.create({ data: { name: `dq-check ${stamp}`, slug: `dq-check-${stamp}` } })).id;
  try {
    const mkCampaign = (name: string) => prisma.campaign.create({ data: { name, industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId: ws } });
    const c1 = await mkCampaign("one");
    const c2 = await mkCampaign("two");
    const leads = new LeadsService(prisma);
    const base = { workspaceId: ws, source: "google_maps", lat: -6.2, lng: 106.8 };

    // 1. a new lead is compared with earlier leads of the workspace, across campaigns
    await leads.createMany([
      { ...base, campaignId: c1.id, name: "Contoh Studio", phone: "0812-0000-1111", website: "https://contoh-studio.example.com" },
      { ...base, campaignId: c1.id, name: "Toko Tutup", phone: "0812-0000-2222", businessStatus: "permanently_closed" },
      { ...base, campaignId: c1.id, name: "Tanpa WhatsApp", phone: "0812-0000-9999" },
      { ...base, campaignId: c1.id, name: "Email Rusak", phone: "0812-0000-3333", website: "https://rusak.example.com" },
    ]);
    await leads.createMany([
      { ...base, campaignId: c2.id, name: "Nama Lain Sama Sekali", phone: "+62 812 0000 1111" },
      { ...base, campaignId: c2.id, name: "Cabang Web", website: "http://www.contoh-studio.example.com/kontak" },
      { ...base, campaignId: c2.id, name: "Outlet Lain", phone: "0812-0000-4445", website: "http://www.contoh-studio.example.com/outlet" },
      { ...base, campaignId: c2.id, name: "Akun Instagram A", phone: "0812-0000-5555", website: "https://instagram.com/a" },
      { ...base, campaignId: c2.id, name: "Akun Instagram B", phone: "0812-0000-6666", website: "https://instagram.com/b" },
    ]);
    const byName = async (n: string) => prisma.lead.findFirstOrThrow({ where: { workspaceId: ws, name: n } });
    const original = await byName("Contoh Studio");
    const dupPhone = await byName("Nama Lain Sama Sekali");
    const dupSite = await byName("Cabang Web");
    check("same phone in another campaign is marked as a repeat", dupPhone.duplicateOfId === original.id && dupPhone.dataQuality === "low" && dupPhone.qualityIssues.includes("duplicate"));
    check("same website domain is marked as a repeat", dupSite.duplicateOfId === original.id);
    check("an outlet with its own number on the same website is a separate lead", (await byName("Outlet Lain")).duplicateOfId === null);
    check("shared profile pages are not repeats", !(await byName("Akun Instagram A")).duplicateOfId && !(await byName("Akun Instagram B")).duplicateOfId);
    check("the original is clean and high", original.duplicateOfId === null && original.dataQuality === "high");
    const closed = await byName("Toko Tutup");
    check("a permanently closed business is stored as low", closed.businessStatus === "permanently_closed" && closed.dataQuality === "low");
    const meta = original.fieldMeta as Record<string, { source: string }> | null;
    check("the source of each field is recorded", meta?.phone?.source === "google_maps" && meta?.website?.source === "google_maps");

    // 2. filtering by quality
    const low = await leads.findAll(ws, { quality: "low", limit: 50 });
    const names = (low.data as { name: string }[]).map((l) => l.name).sort();
    check("the list can be filtered by quality", names.join("|") === ["Cabang Web", "Nama Lain Sama Sekali", "Toko Tutup"].sort().join("|"), names.join(", "));

    // 3. deleting the original frees its repeats
    const tmpC = await mkCampaign("tmp");
    await leads.createMany([{ ...base, campaignId: tmpC.id, name: "Asli Sementara", phone: "0812-7777-0001" }, { ...base, campaignId: c2.id, name: "Salinan Sementara", phone: "0812-7777-0001" }]);
    check("a repeat of a lead in another campaign is marked", !!(await byName("Salinan Sementara")).duplicateOfId);
    await prisma.campaign.delete({ where: { id: tmpC.id } });
    check("deleting the original frees the repeat", (await byName("Salinan Sementara")).duplicateOfId === null);

    // 4. leads saved before this feature get rated by the recompute, and a second run changes nothing
    await prisma.lead.createMany({ data: [
      { workspaceId: ws, campaignId: c1.id, name: "Lama Pertama", phone: "0812-8888-0001", phoneE164: "628128888000" + "1", createdAt: new Date("2026-01-01") },
      { workspaceId: ws, campaignId: c1.id, name: "Lama Kedua", phone: "0812-8888-0001", phoneE164: "628128888000" + "1", createdAt: new Date("2026-01-02") },
    ] });
    const first = await leads.recomputeQuality(ws);
    const lamaPertama = await byName("Lama Pertama");
    const lamaKedua = await byName("Lama Kedua");
    check("recompute keeps the earliest lead as the original", lamaPertama.duplicateOfId === null && lamaKedua.duplicateOfId === lamaPertama.id);
    check("recompute fills in the source of fields", !!lamaPertama.fieldMeta && lamaPertama.dataQuality !== null);
    const second = await leads.recomputeQuality(ws);
    check("a second recompute changes nothing", second.updated === 0 && first.checked === second.checked, JSON.stringify(second));

    // 5. WhatsApp drafting: closed and repeated leads are skipped, a number off WhatsApp is skipped before the writer is called
    await prisma.whatsappAccount.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws }, update: {} });
    const wa = new FakeWa();
    const messaging = new MessagingService(prisma, writer, wa, entitlements, {} as never, noEnrichment);
    const job = await messaging.startGeneration(ws, { campaignId: c1.id, limit: 50, includeMedium: true });
    await waitDone(() => messaging.generationStatus(ws));
    const drafts = await prisma.outboundMessage.findMany({ where: { workspaceId: ws, channel: "whatsapp" }, include: { lead: { select: { name: true } } } });
    const drafted = drafts.map((d) => d.lead?.name).sort();
    check("WhatsApp drafts are written only for leads that can be reached", drafted.join("|") === ["Contoh Studio", "Email Rusak", "Lama Pertama"].sort().join("|"), drafted.join(", "));
    check("the closed lead was counted as low quality", (messaging.generationStatus(ws)?.skipped.lowQuality ?? 0) >= 1, JSON.stringify(job.skipped));
    check("a number off WhatsApp was dropped before any draft was written", (messaging.generationStatus(ws)?.skipped.notOnWhatsapp ?? 0) === 1 && !drafted.includes("Tanpa WhatsApp"));
    const saved = (await byName("Tanpa WhatsApp")).validation as { waRegistered?: boolean } | null;
    check("the WhatsApp answer is saved on the lead", saved?.waRegistered === false);
    const lookupsBefore = wa.lookups.length;
    const again = await messaging.startGeneration(ws, { campaignId: c1.id, limit: 50, includeMedium: true });
    await waitDone(() => messaging.generationStatus(ws));
    check("a saved answer is not asked again", wa.lookups.length === lookupsBefore, `${again.total} planned`);

    // 6. e-mail drafting: a domain that cannot receive mail is dropped (needs DNS)
    const dnsUp = (await checkEmailDomain("a@example.com")) !== null;
    if (!dnsUp) {
      skip("e-mail domain check (no DNS available)");
    } else {
      const c3 = await mkCampaign("mail");
      await leads.createMany([
        { ...base, campaignId: c3.id, name: "Surel Baik", phone: "0812-9000-0001" },
        { ...base, campaignId: c3.id, name: "Surel Mati", phone: "0812-9000-0002" },
      ]);
      await prisma.lead.updateMany({ where: { workspaceId: ws, name: "Surel Baik" }, data: { email: "halo@example.com" } });
      await prisma.lead.updateMany({ where: { workspaceId: ws, name: "Surel Mati" }, data: { email: "halo@domain-yang-tidak-ada-xyz.invalid" } });
      const email = new EmailService(prisma, new ConfigService({ ENCRYPTION_KEY: Buffer.alloc(32).toString("base64") }), writer, noEnrichment);
      await email.startGeneration(ws, { campaignId: c3.id, limit: 10, includeMedium: true });
      await waitDone(() => email.generationStatus(ws));
      const mails = await prisma.outboundMessage.findMany({ where: { workspaceId: ws, channel: "email" }, include: { lead: { select: { name: true } } } });
      check("an e-mail is drafted only for a domain that can receive mail", mails.length === 1 && mails[0].lead?.name === "Surel Baik", mails.map((m) => m.lead?.name).join(", "));
      check("the dead domain is counted and saved", (email.generationStatus(ws)?.skipped.badEmail ?? 0) === 1 && ((await byName("Surel Mati")).validation as { emailMx?: boolean } | null)?.emailMx === false);
    }
  } finally {
    await prisma.workspace.delete({ where: { id: ws } });
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
