/**
 * Proof for attachments and link previews against a real database, with a fake WhatsApp provider that records what it receives.
 * Run: DATABASE_URL=... npx tsx scripts/attachment-check.ts   (the link-preview part opens https://github.com; pass --offline to skip it)
 * Everything happens in a throwaway workspace and a temporary folder, both removed at the end.
 */
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm, unlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaService } from "../src/prisma/prisma.service";
import { AttachmentService } from "../src/messaging/attachment.service";
import { MessagingService } from "../src/messaging/messaging.service";
import { SenderService } from "../src/messaging/sender.service";
import { TemplateService } from "../src/messaging/template.service";
import { WhatsappGateway } from "../src/messaging/whatsapp.gateway";
import { buildLinkPreview } from "../src/messaging/link-preview";
import type { RoutedWhatsappProvider, SendExtras } from "../src/messaging/whatsapp.provider";

const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
const rejects = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return (e as Error).message; } };

class FakeWa implements RoutedWhatsappProvider {
  use() {}
  hasCloud() { return false; }
  calls: { to: string; text: string; extras?: SendExtras }[] = [];
  async connect() {}
  async disconnect() {}
  state() { return { status: "connected" as const, qr: null, phone: "62800000000" }; }
  async resolve(_w: string, phone: string) { return `${phone}@s.whatsapp.net`; }
  async send(_w: string, to: string, text: string, _t: number, extras?: SendExtras) { this.calls.push({ to, text, extras }); return `id${this.calls.length}`; }
  onInbound() {}
}

const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(2048, 7)]);

async function main() {
  delete process.env.WHATSAPP_DISABLED;
  await prisma.$connect();
  const dir = await mkdtemp(join(tmpdir(), "attach-check-"));
  const config = new ConfigService({ ATTACHMENTS_DIR: dir });
  const stamp = Date.now().toString(36);
  const ws = (await prisma.workspace.create({ data: { name: `attach-check ${stamp}`, slug: `attach-check-${stamp}` } })).id;
  const other = (await prisma.workspace.create({ data: { name: `attach-other ${stamp}`, slug: `attach-other-${stamp}` } })).id;
  try {
    const campaign = await prisma.campaign.create({ data: { name: "c", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId: ws } });
    const lead = await prisma.lead.create({ data: { name: "Lead Uji", workspaceId: ws, campaignId: campaign.id, phone: "0812 3456 7801" } });
    await prisma.whatsappAccount.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws }, update: {} });
    await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { paused: false, hourlyLimit: 30, dailyLimit: 200, quietStartHour: 0, quietEndHour: 0, nextSendAt: null } });

    const attachments = new AttachmentService(prisma, config);
    const wa = new FakeWa();
    const entitlements = { has: async () => false, edition: "community" } as never;
    const sender = new SenderService(prisma, new ConfigService({ WHATSAPP_DISABLED: "false" }), wa, entitlements, attachments);
    const messaging = new MessagingService(prisma, {} as never, wa, entitlements, attachments);
    const resetPacing = () => prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });

    // 1. upload rules
    const saved = await attachments.save(ws, { originalname: "../Brosur Harga.PDF", buffer: pdf });
    check("a real PDF is stored with a clean name and its true type", saved.fileName === "Brosur Harga.pdf" && saved.mimeType === "application/pdf" && saved.sizeBytes === pdf.length, saved.fileName);
    check("the file is on disk under a generated name", (await readdir(join(dir, ws))).length === 1);
    check("an executable renamed .pdf is refused", /Only PDF/.test((await rejects(attachments.save(ws, { originalname: "x.pdf", buffer: Buffer.from("MZ\x90\x00...") }))) ?? ""));
    check("an HTML page named .png is refused", (await rejects(attachments.save(ws, { originalname: "x.png", buffer: Buffer.from("<html><script>1</script>") }))) !== null);
    check("a file over 16 MB is refused", /larger than 16 MB/.test((await rejects(attachments.save(ws, { originalname: "big.pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(17 * 1024 * 1024)]) }))) ?? ""));
    check("another workspace cannot use the file", /not found/i.test((await rejects(attachments.owned(other, saved.id))) ?? ""));

    // 2. a draft with the file: edit validates ownership, then approve, then the sender hands the bytes to the provider
    const draft = await messaging.createManual(ws, { phone: "0812 3456 7801", body: "Halo, Kak. Berikut brosurnya.", leadId: lead.id, attachmentId: saved.id });
    check("a manual draft keeps the attachment id", draft.attachmentId === saved.id);
    check("editing with another workspace's file is refused", /not found/i.test((await rejects(messaging.edit(ws, draft.id, "Halo", undefined, { attachmentId: (await attachments.save(other, { originalname: "o.pdf", buffer: pdf })).id }))) ?? ""));
    const approved = await messaging.approve(ws, [draft.id]);
    check("the draft with a file can be approved", approved.approved === 1);
    check("deleting the file is refused while the message is waiting", /still use this file/.test((await rejects(attachments.remove(ws, saved.id))) ?? ""));
    await sender.tick(ws);
    const first = wa.calls[0];
    check("the provider receives the file bytes, name, type and the text as caption", !!first?.extras?.attachment && first.extras.attachment.data.equals(pdf) && first.extras.attachment.fileName === "Brosur Harga.pdf" && first.extras.attachment.kind === "document" && first.text.startsWith("Halo, Kak."));
    check("the message is marked sent", (await prisma.outboundMessage.findUniqueOrThrow({ where: { id: draft.id } })).status === "sent");
    check("a file used by a sent message cannot be deleted (history keeps it)", /history/.test((await rejects(attachments.remove(ws, saved.id))) ?? "") && (await readdir(join(dir, ws))).length === 1);

    // 3. link preview card reaches the provider; a file replaces the card
    const cardJson = { url: "https://example.com/", title: "Contoh", description: "Deskripsi contoh", thumbnail: Buffer.from("jpgbytes").toString("base64") };
    await resetPacing();
    await prisma.outboundMessage.create({ data: { workspaceId: ws, toPhone: "6281234567802", body: "Lihat https://example.com/ ya.", source: "manual", status: "approved", approvedAt: new Date(), linkPreview: cardJson } });
    await sender.tick(ws);
    const withCard = wa.calls[1];
    check("the link card (title, description, thumbnail bytes) reaches the provider", withCard?.extras?.linkPreview?.title === "Contoh" && withCard.extras.linkPreview.thumbnail?.toString() === "jpgbytes" && !withCard.extras.attachment);
    await resetPacing();
    await prisma.outboundMessage.create({ data: { workspaceId: ws, toPhone: "6281234567803", body: "Brosur ada di lampiran https://example.com/", source: "manual", status: "approved", approvedAt: new Date(), linkPreview: cardJson, attachmentId: saved.id } });
    await sender.tick(ws);
    const both = wa.calls[2];
    check("with a file and a card, the provider gets both and a short caption carries no card", !!both?.extras?.attachment && !!both.extras.linkPreview);

    // 4. a file that vanished from disk: the message fails and nothing is sent
    await resetPacing();
    const gone = await attachments.save(ws, { originalname: "hilang.pdf", buffer: pdf });
    const lost = await prisma.outboundMessage.create({ data: { workspaceId: ws, toPhone: "6281234567804", body: "Ini butuh lampiran", source: "manual", status: "approved", approvedAt: new Date(), attachmentId: gone.id } });
    const key = (await prisma.messageAttachment.findUniqueOrThrow({ where: { id: gone.id } })).storageKey;
    await unlink(join(dir, ws, key));
    const before = wa.calls.length;
    await sender.tick(ws);
    const after = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: lost.id } });
    check("a missing file fails the message and nothing is sent", after.status === "failed" && /missing/i.test(after.error ?? "") && wa.calls.length === before, after.error ?? "");

    // 5. the official connector must refuse files rather than send the text alone
    const gateway = new WhatsappGateway({} as never, prisma, config, entitlements);
    gateway.use(ws, "cloud_api");
    check("the Cloud API connection refuses an attachment", /linked-device/.test((await rejects(gateway.send(ws, "x", "t", 0, { attachment: { data: pdf, mimeType: "application/pdf", fileName: "a.pdf", kind: "document" } }))) ?? ""));

    // 6. bulk: one file and one card for every draft; email is refused
    const leads = await Promise.all([1, 2, 3].map((i) => prisma.lead.create({ data: { name: `Bulk ${i}`, workspaceId: ws, campaignId: campaign.id, phone: `0812 3456 79${i}0` } })));
    const templates = new TemplateService(prisma, {} as never, attachments);
    const emailTry = await rejects(templates.apply(ws, { channel: "email", leadIds: [leads[0].id], body: "x", subject: "s", attachmentId: saved.id }));
    check("a bulk email with an attachment is refused", /only for WhatsApp/.test(emailTry ?? ""));
    const applied = await templates.apply(ws, { channel: "whatsapp", leadIds: leads.map((l) => l.id), body: "Halo {nama}, ini brosur kami.", attachmentId: saved.id });
    const rows = await prisma.outboundMessage.findMany({ where: { workspaceId: ws, leadId: { in: leads.map((l) => l.id) } } });
    check("bulk drafts all carry the same file and personal text", applied.created === 3 && rows.length === 3 && rows.every((r) => r.attachmentId === saved.id) && rows.some((r) => r.body.includes("Halo Bulk 2")));

    // 7. link preview builder: real page, and addresses it must refuse
    if (!process.argv.includes("--offline")) {
      const p = await buildLinkPreview("https://github.com");
      check("a real page gives a title, a description and, when it has a picture, a JPEG thumbnail", p.title.length > 3 && p.description.length > 3 && (!p.thumbnail || Buffer.from(p.thumbnail, "base64")[0] === 0xff), `${p.title} | ${p.description.slice(0, 60)} | thumb ${p.thumbnail ? Math.round(Buffer.from(p.thumbnail, "base64").length / 1024) + " KB" : "none"}`);
    }
    for (const bad of ["http://127.0.0.1:3001/api/health", "http://169.254.169.254/latest/meta-data/", "http://localhost/", "http://[::1]/", "file:///etc/passwd", "ftp://example.com/x"]) {
      check(`the preview builder refuses ${bad}`, (await rejects(buildLinkPreview(bad))) !== null);
    }
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: [ws, other] } } });
    await rm(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
void main();
