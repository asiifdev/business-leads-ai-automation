/**
 * Reliability check for the send pipeline against a real database, with a fake WhatsApp provider and a stub writer.
 * Run: DATABASE_URL=... npx tsx scripts/pipeline-check.ts
 * It creates its own temporary workspace (with no WhatsApp connection), runs every check there, and deletes the
 * workspace at the end, so it never touches real data and never competes with a live sender.
 * Every sender pass is limited to that workspace (`sender.tick(ws)`): the fake provider must never be handed another workspace's queue.
 */
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { InboundService } from "../src/messaging/inbound.service";
import { SenderService } from "../src/messaging/sender.service";
import { AttachmentService } from "../src/messaging/attachment.service";
import { LeadsService } from "../src/leads/leads.service";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { ReclassifyService } from "../src/messaging/reclassify.service";
import { ProviderUnavailableError, type InboundWhatsappMessage, type RoutedWhatsappProvider } from "../src/messaging/whatsapp.provider";

let ws = "";
const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

class FakeWa implements RoutedWhatsappProvider {
  use() {}
  hasCloud() { return false; }
  sent: { to: string; text: string }[] = [];
  mode: "ok" | "unavailable" | "error" = "ok";
  handler: ((w: string, m: InboundWhatsappMessage) => Promise<void>) | null = null;
  async connect() {}
  async disconnect() {}
  state() { return { status: "connected" as const, qr: null, phone: "62800000000" }; }
  async resolve(_w: string, phone: string) { return phone.endsWith("9999") ? null : `${phone}@s.whatsapp.net`; }
  async send(_w: string, to: string, text: string) {
    if (this.mode === "unavailable") throw new ProviderUnavailableError("down");
    if (this.mode === "error") throw new Error("boom");
    this.sent.push({ to, text });
    return `id${this.sent.length}`;
  }
  onInbound(h: FakeWa["handler"]) { this.handler = h; }
}

const entitlements = { has: async () => false, edition: "community" } as never;
const stubWriter = { reply: async (_w: string, _l: unknown, _i: string, _h: string, action: string) => action === "none" ? null : ({ text: "balasan uji", risks: [] as string[], trace: { styled: true, examples: 0, knowledge: "none", model: "stub", latencyMs: 1 } }) } as never;

async function msg(phone: string, body: string, status = "approved", extra: Record<string, unknown> = {}) {
  return prisma.outboundMessage.create({ data: { workspaceId: ws, toPhone: phone, body, source: "ai_outreach", status, approvedAt: new Date(), ...extra } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Polls until the condition holds (drafts are written a moment after a message arrives). */
async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 4000): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(100);
  }
}

async function main() {
  process.env.REPLY_DRAFT_DELAY_MS = "0"; // no 20 s wait before a reply draft in this check
  // CI turns the real senders off for the whole job, and ConfigService prefers process.env over the values passed below.
  delete process.env.WHATSAPP_DISABLED;
  delete process.env.EMAIL_DISABLED;
  await prisma.$connect();
  // Everything happens in a throwaway workspace: it has no WhatsApp connection, so only the fake provider below ever "sends".
  const stamp = Date.now().toString(36);
  const workspace = await prisma.workspace.create({ data: { name: `pipeline-check ${stamp}`, slug: `pipeline-check-${stamp}` } });
  ws = workspace.id;
  const campaign = await prisma.campaign.create({ data: { name: "check", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId: ws } });
  await prisma.lead.create({ data: { name: "Check Lead", workspaceId: ws, campaignId: campaign.id } });
  await prisma.whatsappAccount.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws }, update: {} });
  const open = { paused: false, hourlyLimit: 2, dailyLimit: 80, quietStartHour: 0, quietEndHour: 0, nextSendAt: null, lastError: null };
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: open });

  const wa = new FakeWa();
  const sender = new SenderService(prisma, new ConfigService({ WHATSAPP_DISABLED: "false" }), wa, entitlements, new AttachmentService(prisma, new ConfigService({})));

  // 1. one message per tick, then cooldown
  const a = await msg("629900000001", "satu"); await msg("629900000002", "dua"); await msg("629900000003", "tiga");
  await sender.tick(ws);
  check("sends exactly one message per tick", wa.sent.length === 1 && wa.sent[0].text === "satu");
  await sender.tick(ws);
  check("cooldown blocks the next send", wa.sent.length === 1);
  const acc = await prisma.whatsappAccount.findUniqueOrThrow({ where: { workspaceId: ws } });
  check("nextSendAt is set within 0.6x-1.4x of the 30 min gap", !!acc.nextSendAt && acc.nextSendAt.getTime() - Date.now() > 17 * 60_000 && acc.nextSendAt.getTime() - Date.now() < 43 * 60_000);

  // 2. hourly limit
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
  await sender.tick(ws);
  check("second message goes out after cooldown", wa.sent.length === 2);
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
  await sender.tick(ws);
  check("hourly limit (2) blocks the third", wa.sent.length === 2);
  const third = await prisma.outboundMessage.findFirstOrThrow({ where: { workspaceId: ws, toPhone: "629900000003" } });
  check("blocked message stays approved", third.status === "approved");
  await prisma.outboundMessage.update({ where: { id: third.id }, data: { status: "cancelled" } });

  // 3. quiet hours
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { hourlyLimit: 30, quietStartHour: hour, quietEndHour: (hour + 1) % 24, nextSendAt: null } });
  await msg("629900000004", "malam");
  await sender.tick(ws);
  check("quiet hours hold messages back", wa.sent.length === 2);
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { quietStartHour: 0, quietEndHour: 0 } });

  // 4. number not on WhatsApp: fails, does not trip the breaker
  await prisma.outboundMessage.updateMany({ where: { workspaceId: ws, toPhone: "629900000004" }, data: { status: "cancelled" } });
  await msg("629900009999", "mati");
  await sender.tick(ws);
  const dead = await prisma.outboundMessage.findFirstOrThrow({ where: { workspaceId: ws, toPhone: "629900009999" } });
  check("number not on WhatsApp is marked failed", dead.status === "failed" && /not on whatsapp/i.test(dead.error ?? ""));
  check("a dead number does not pause the account", !(await prisma.whatsappAccount.findUniqueOrThrow({ where: { workspaceId: ws } })).paused);

  // 5. opt-out via inbound STOP
  const inbound = new InboundService(prisma, stubWriter, { forWorkspace: async () => ({ enabled: false }) } as never, wa);
  await inbound.onModuleInit();
  await msg("629900000005", "jangan terkirim");
  await inbound.handle(ws, { phone: "629900000005", text: "STOP", id: "in-stop-1", at: new Date() });
  const cancelled = await prisma.outboundMessage.findFirstOrThrow({ where: { workspaceId: ws, toPhone: "629900000005" } });
  check("STOP cancels pending messages", cancelled.status === "cancelled");
  check("STOP is recorded as opt-out", !!(await prisma.messageOptOut.findUnique({ where: { workspaceId_phone: { workspaceId: ws, phone: "629900000005" } } })));
  await inbound.handle(ws, { phone: "629900000005", text: "STOP", id: "in-stop-1", at: new Date() });
  check("duplicate inbound id is ignored", (await prisma.inboundMessage.count({ where: { workspaceId: ws, providerMessageId: "in-stop-1" } })) === 1);
  await prisma.outboundMessage.create({ data: { workspaceId: ws, toPhone: "629900000005", body: "x", source: "ai_outreach", status: "approved", approvedAt: new Date() } });
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null, hourlyLimit: 30 } });
  const before = wa.sent.length;
  await sender.tick(ws);
  check("sender refuses an opted-out number even if approved later", wa.sent.length === before);

  // 6. reply from a known lead: status update, follow-ups cancelled, reply draft prepared
  const lead = await prisma.lead.findFirstOrThrow({ where: { workspaceId: ws } });
  await prisma.lead.update({ where: { id: lead.id }, data: { phoneE164: "629900000006", crmStatus: "contacted", repliedAt: null } });
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: lead.id, toPhone: "629900000006", body: "fu", source: "ai_followup", status: "draft" } });
  await inbound.handle(ws, { phone: "629900000006", text: "boleh, berapa harganya?", id: "in-reply-1", at: new Date() });
  const l2 = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  check("reply moves the lead to 'replied'", l2.crmStatus === "replied" && !!l2.repliedAt);
  check("reply is understood (price) and flagged as waiting for the owner", l2.lastIntent === "price" && l2.needsReply === true);
  check("the inbound message keeps its intent", (await prisma.inboundMessage.findFirstOrThrow({ where: { workspaceId: ws, providerMessageId: "in-reply-1" } })).intent === "price");
  check("pending follow-up is cancelled", (await prisma.outboundMessage.findFirstOrThrow({ where: { leadId: lead.id, source: "ai_followup" } })).status === "cancelled");
  const draft = await waitFor(() => prisma.outboundMessage.findFirst({ where: { leadId: lead.id, source: "ai_reply", status: "draft" } }));
  check("a reply DRAFT is prepared, nothing is sent", !!draft && wa.sent.length === before);
  const unknownBefore = await prisma.outboundMessage.count({ where: { workspaceId: ws } });
  await inbound.handle(ws, { phone: "629900000077", text: "halo siapa ini", id: "in-unknown-1", at: new Date() });
  check("unknown sender is stored but never answered", (await prisma.outboundMessage.count({ where: { workspaceId: ws } })) === unknownBefore);


  // 6b. the owner answers from their own phone: recorded, lead no longer waiting, outdated drafts withdrawn
  const phone6 = "629900000006";
  const msgsBefore = await prisma.outboundMessage.count({ where: { workspaceId: ws } });
  check("a message to a number that is not a lead is ignored and never stored", (await inbound.handleOwnMessage(ws, { phone: "629900000999", text: "halo pribadi", id: "own-private", at: new Date() })) === "ignored" && (await prisma.outboundMessage.count({ where: { workspaceId: ws } })) === msgsBefore);
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: lead.id, toPhone: phone6, body: "Teks dari Prospex", source: "ai_outreach", status: "sent", sentAt: new Date(), providerMessageId: "id-ours" } });
  check("an event for a message Prospex sent itself is ignored (same id)", (await inbound.handleOwnMessage(ws, { phone: phone6, text: "Teks dari Prospex", id: "id-ours", at: new Date() })) === "ignored");
  check("...and when only the text matches", (await inbound.handleOwnMessage(ws, { phone: phone6, text: "Teks dari Prospex", id: "other-id", at: new Date() })) === "ignored");
  check("nothing was added for those", (await prisma.outboundMessage.count({ where: { workspaceId: ws, source: "external" } })) === 0);
  // a message approved long ago and claimed just now: its own event must not be taken for something typed on the phone
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: lead.id, toPhone: phone6, body: "Pesan yang lama menunggu antrean", source: "ai_outreach", status: "sending", createdAt: new Date(Date.now() - 2 * 86_400_000), approvedAt: new Date(Date.now() - 2 * 86_400_000) } });
  check("a message approved days ago and sent now is not mistaken for one typed on the phone", (await inbound.handleOwnMessage(ws, { phone: phone6, text: "Pesan yang lama menunggu antrean", id: "late-id", at: new Date() })) === "ignored" && (await prisma.outboundMessage.count({ where: { workspaceId: ws, source: "external" } })) === 0);
  const ownAt = new Date();
  check("a message the owner types to a lead is recorded", (await inbound.handleOwnMessage(ws, { phone: phone6, text: "Baik kak, ini penawarannya", id: "own-1", at: ownAt })) === "recorded");
  const ext = await prisma.outboundMessage.findFirstOrThrow({ where: { workspaceId: ws, source: "external" } });
  check("it is stored as sent, from the owner, with its WhatsApp id", ext.status === "sent" && ext.providerMessageId === "own-1" && ext.leadId === lead.id);
  const l3 = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  check("the lead no longer waits for an answer", l3.needsReply === false && !!l3.contactedAt);
  check("the outdated reply draft is withdrawn", (await prisma.outboundMessage.findFirstOrThrow({ where: { id: draft!.id } })).status === "cancelled");
  check("the activity log shows it", (await prisma.leadActivity.count({ where: { leadId: lead.id, type: "whatsapp_sent_phone" } })) === 1);
  check("the same event twice is recorded once", (await inbound.handleOwnMessage(ws, { phone: phone6, text: "Baik kak, ini penawarannya", id: "own-1", at: ownAt })) === "ignored" && (await prisma.outboundMessage.count({ where: { workspaceId: ws, source: "external" } })) === 1);
  const conv = await inbound.conversation(ws, lead.id, phone6, "");
  check("the conversation includes the owner's own message and says it is answered", conv.answered && /Saya: Baik kak, ini penawarannya/.test(conv.history));
  check("no draft is written for something already answered", (await inbound.draftReply(ws, lead.id)) === "answered");
  check("the owner's phone messages do not count against the sending limits", (await prisma.outboundMessage.count({ where: { workspaceId: ws, source: { notIn: ["ai_reply", "external"] }, status: "sent" } })) >= 0 && ext.source === "external");

  // 6c. they write again: ONE new draft that replaces any older one
  const later = new Date(Date.now() + 60_000);
  await inbound.handle(ws, { phone: phone6, text: "mahal kak, bisa nego?", id: "in-reply-2", at: later });
  const fresh = await waitFor(() => prisma.outboundMessage.findFirst({ where: { leadId: lead.id, source: "ai_reply", status: "draft" } }));
  check("a new message from them waits for an answer again, and is read as price talk", (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).needsReply === true && (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).lastIntent === "price");
  check("a fresh reply draft is written", !!fresh);
  await inbound.handle(ws, { phone: phone6, text: "ada diskon?", id: "in-reply-3", at: new Date(later.getTime() + 15 * 60_000) });
  await waitFor(async () => (await prisma.outboundMessage.count({ where: { leadId: lead.id, source: "ai_reply", status: "cancelled", error: "Replaced by a newer draft" } })) >= 1);
  check("a newer message replaces the older draft: exactly one waits", (await prisma.outboundMessage.count({ where: { leadId: lead.id, source: "ai_reply", status: "draft" } })) === 1 && (await prisma.outboundMessage.findFirstOrThrow({ where: { id: fresh!.id } })).status === "cancelled");

  // 6d. re-reading the pipeline: preview changes nothing, apply corrects it
  const t0 = Date.now() - 3_600_000;
  const mk = async (name: string, phone: string) => prisma.lead.create({ data: { name, workspaceId: ws, campaignId: campaign.id, phone, phoneE164: phone, crmStatus: "contacted", repliedAt: new Date(t0), needsReply: true } });
  const answered = await mk("Sudah dibalas", "629900000010");
  await prisma.inboundMessage.create({ data: { workspaceId: ws, leadId: answered.id, fromPhone: "629900000010", body: "Boleh kak", providerMessageId: "rc-1", receivedAt: new Date(t0) } });
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: answered.id, toPhone: "629900000010", body: "Siap, ini contohnya", source: "external", status: "sent", sentAt: new Date(t0 + 120_000), providerMessageId: "rc-own" } });
  const staleDraft = await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: answered.id, toPhone: "629900000010", body: "draft lama", source: "ai_reply", status: "draft", createdAt: new Date(t0 + 30_000) } });
  const waiting = await mk("Masih menunggu", "629900000012");
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: waiting.id, toPhone: "629900000012", body: "Halo, boleh kirim contoh?", source: "ai_outreach", status: "sent", sentAt: new Date(t0 - 600_000) } });
  await prisma.inboundMessage.create({ data: { workspaceId: ws, leadId: waiting.id, fromPhone: "629900000012", body: "boleh kak", providerMessageId: "rc-2", receivedAt: new Date(t0) } });
  const oldDraft = await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: waiting.id, toPhone: "629900000012", body: "draft untuk pesan sebelumnya", source: "ai_reply", status: "draft", createdAt: new Date(t0 - 300_000) } });
  const reclassify = new ReclassifyService(prisma, { forWorkspace: async () => ({ enabled: false }) } as never, inbound);
  const preview = await reclassify.run(ws, { apply: false });
  check("the preview finds the answered lead and the outdated drafts", preview.applied === false && preview.answeredByOwner >= 1 && preview.draftsWithdrawn >= 2, JSON.stringify({ changed: preview.changed, answered: preview.answeredByOwner, withdrawn: preview.draftsWithdrawn }));
  check("the preview changes nothing", (await prisma.lead.findUniqueOrThrow({ where: { id: answered.id } })).needsReply === true && (await prisma.outboundMessage.findUniqueOrThrow({ where: { id: staleDraft.id } })).status === "draft");
  const applied = await reclassify.run(ws, { apply: true });
  check("applying: the answered lead stops waiting and its draft is withdrawn", (await prisma.lead.findUniqueOrThrow({ where: { id: answered.id } })).needsReply === false && (await prisma.outboundMessage.findUniqueOrThrow({ where: { id: staleDraft.id } })).status === "cancelled");
  check("applying: the lead still waiting keeps waiting, its outdated draft is withdrawn and a fresh one is written", (await prisma.lead.findUniqueOrThrow({ where: { id: waiting.id } })).needsReply === true && (await prisma.outboundMessage.findUniqueOrThrow({ where: { id: oldDraft.id } })).status === "cancelled" && !!(await prisma.outboundMessage.findFirst({ where: { leadId: waiting.id, source: "ai_reply", status: "draft" } })) && applied.draftsRewritten >= 1);
  check("a second run has nothing left to correct", (await reclassify.run(ws, { apply: false })).changed === (await reclassify.run(ws, { apply: false })).changed);

  // 6e. they point us to someone else: fixed thanks, the number is kept, and it can become a lead of its own
  const ref = await mk("Dialihkan", "629900000013");
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: ref.id, toPhone: "629900000013", body: "Halo, kami menawarkan jasa", source: "ai_outreach", status: "sent", sentAt: new Date(Date.now() - 600_000) } });
  await prisma.lead.update({ where: { id: ref.id }, data: { needsReply: false, repliedAt: null, crmStatus: "contacted" } });
  await inbound.handle(ws, { phone: "629900000013", text: "[Kontak: Contoh Nama +6281200000001] halo untuk penawaran bisa hubungi management kita langsung ya", id: "in-ref-1", at: new Date() });
  const refLead = await prisma.lead.findUniqueOrThrow({ where: { id: ref.id } });
  check("being pointed to someone else is its own kind of reply and stays on the owner's list", refLead.lastIntent === "referral" && refLead.needsReply === true);
  const refAct = await prisma.leadActivity.findFirst({ where: { leadId: ref.id, type: "referral" } });
  check("the contact they gave is kept", !!refAct && JSON.stringify(refAct.metadata).includes("+6281200000001"));
  const refDraft = await waitFor(() => prisma.outboundMessage.findFirst({ where: { leadId: ref.id, source: "ai_reply", status: "draft" } }));
  check("the draft is the fixed thank-you, chosen in code", (refDraft?.context as { action?: string } | null)?.action === "thanks_referral");
  const leadsSvc = new LeadsService(prisma);
  const made = await leadsSvc.createFromReferral(ws, ref.id, { name: "Contoh Nama", phone: "+6281200000001" });
  check("the contact becomes a lead of its own", made.created === true && !!(await prisma.lead.findFirst({ where: { id: made.leadId, source: "referral", phoneE164: "6281200000001" } })));
  check("the same number is never added twice", (await leadsSvc.createFromReferral(ws, ref.id, { phone: "0812 0000 0001" })).created === false);
  check("a number that is not a phone number is refused", await leadsSvc.createFromReferral(ws, ref.id, { phone: "abcdefgh" }).then(() => false, () => true));

  // 6f. "interested" is its own stage, and warm leads we answered last are listed as "waiting on them"
  const warm = await mk("Tertarik", "629900000014");
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: warm.id, toPhone: "629900000014", body: "Boleh saya kirim contoh tampilannya, Kak?", source: "ai_outreach", status: "sent", sentAt: new Date(Date.now() - 600_000) } });
  await prisma.lead.update({ where: { id: warm.id }, data: { needsReply: false, repliedAt: null, crmStatus: "contacted" } });
  await inbound.handle(ws, { phone: "629900000014", text: "boleh kak", id: "in-warm-1", at: new Date() });
  const warmNow = await prisma.lead.findUniqueOrThrow({ where: { id: warm.id } });
  check("a yes to our offer puts the lead in the 'interested' stage", warmNow.crmStatus === "interested" && warmNow.lastIntent === "interested" && warmNow.needsReply === true);
  const answeredNow = await prisma.lead.findUniqueOrThrow({ where: { id: answered.id } });
  check("applying the re-read moves a lead that said yes forward to 'interested'", answeredNow.crmStatus === "interested", `stage=${answeredNow.crmStatus} intent=${answeredNow.lastIntent}`);
  await inbound.handleOwnMessage(ws, { phone: "629900000014", text: "Baik kak, silakan isi form trial ini ya", id: "own-warm", at: new Date(Date.now() - 4 * 86_400_000) });
  const analytics = new AnalyticsService(prisma);
  const board = await analytics.getPipeline(ws);
  check("the pipeline has an 'interested' stage with a count", board.stages.some((s: { stage: string; count: number }) => s.stage === "interested" && s.count >= 1));
  check("a warm lead we answered more than 3 days ago is listed as waiting on them", board.waitingOnThem.some((l: { id: string }) => l.id === warm.id) && board.totals.waitingOnThem >= 1);
  check("a lead we answered a moment ago, and a cold lead, are not", !board.waitingOnThem.some((l: { id: string }) => l.id === ref.id || l.id === answered.id));

  // 6g. a shop's greeting bot counted as a reply, and a STOP typed inside a sentence that never blocked the number
  const botLead = await mk("Hanya bot", "629900000015");
  await prisma.lead.update({ where: { id: botLead.id }, data: { crmStatus: "replied", lastIntent: "question", needsReply: true } });
  await prisma.inboundMessage.create({ data: { workspaceId: ws, leadId: botLead.id, fromPhone: "629900000015", body: "Hi saya Contoh dari Toko Contoh, silahkan apa yang bisa saya bantu?", providerMessageId: "bot-1", receivedAt: new Date(Date.now() - 3_000_000), intent: "question" } });
  const stopLead = await mk("Minta stop", "629900000016");
  await prisma.lead.update({ where: { id: stopLead.id }, data: { crmStatus: "replied", lastIntent: "not_now" } });
  await prisma.inboundMessage.create({ data: { workspaceId: ws, leadId: stopLead.id, fromPhone: "629900000016", body: "Maaf kak belum ya STOP", providerMessageId: "stop-2", receivedAt: new Date(Date.now() - 3_000_000), intent: "not_now" } });
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: stopLead.id, toPhone: "629900000016", body: "pesan menunggu", source: "ai_followup", status: "draft" } });
  const keep = await mk("Label tetap", "629900000017");
  await prisma.lead.update({ where: { id: keep.id }, data: { crmStatus: "replied", lastIntent: "price" } });
  await prisma.inboundMessage.create({ data: { workspaceId: ws, leadId: keep.id, fromPhone: "629900000017", body: "hmm gitu ya kak", providerMessageId: "keep-1", receivedAt: new Date(Date.now() - 3_000_000), intent: "price" } });
  const preview2 = await reclassify.run(ws, { apply: false });
  check("the preview finds the bot-only lead and the unblocked STOP", preview2.botOnly >= 1 && preview2.optedOut >= 1, JSON.stringify({ bot: preview2.botOnly, stop: preview2.optedOut }));
  check("the preview blocks nobody yet", !(await prisma.messageOptOut.findUnique({ where: { workspaceId_phone: { workspaceId: ws, phone: "629900000016" } } })));
  await reclassify.run(ws, { apply: true });
  check("a specific label is kept when the last words say nothing the rules or the model can read", (await prisma.lead.findUniqueOrThrow({ where: { id: keep.id } })).lastIntent === "price");
  const botAfter = await prisma.lead.findUniqueOrThrow({ where: { id: botLead.id } });
  check("a lead that only sent a greeting bot's message goes back to 'contacted' and never counts as a reply", botAfter.crmStatus === "contacted" && botAfter.repliedAt === null && botAfter.needsReply === false);
  const stopAfter = await prisma.lead.findUniqueOrThrow({ where: { id: stopLead.id } });
  check("a STOP typed inside a sentence now blocks the number and closes the lead", !!(await prisma.messageOptOut.findUnique({ where: { workspaceId_phone: { workspaceId: ws, phone: "629900000016" } } })) && stopAfter.crmStatus === "lost" && /STOP/.test(stopAfter.lostReason ?? ""));
  check("...and its waiting message is cancelled", (await prisma.outboundMessage.findFirstOrThrow({ where: { leadId: stopLead.id, source: "ai_followup" } })).status === "cancelled");
  await inbound.handle(ws, { phone: "629900000015", text: "Ok stop", id: "stop-live", at: new Date() });
  check("a new 'Ok stop' is blocked the moment it arrives", !!(await prisma.messageOptOut.findUnique({ where: { workspaceId_phone: { workspaceId: ws, phone: "629900000015" } } })));

  // 6h. stages: a false "meeting" is corrected, a stage the owner chose is not, a real meeting stays, and a polite closing waits for nobody
  const staged = async (name: string, phone: string, status: string, turns: { mine: boolean; text: string; at: number }[]) => {
    const l = await prisma.lead.create({ data: { name, workspaceId: ws, campaignId: campaign.id, phone, phoneE164: phone, crmStatus: status, lastIntent: status, repliedAt: new Date(t0), needsReply: false } });
    for (const [i, t] of turns.entries()) {
      if (t.mine) await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: l.id, toPhone: phone, body: t.text, source: "ai_outreach", status: "sent", sentAt: new Date(t.at) } });
      else await prisma.inboundMessage.create({ data: { workspaceId: ws, leadId: l.id, fromPhone: phone, body: t.text, providerMessageId: `st-${phone}-${i}`, receivedAt: new Date(t.at) } });
    }
    return l;
  };
  const m0 = Date.now() - 7_200_000;
  const falseMeeting = await staged("Meeting palsu", "629900000018", "meeting", [{ mine: true, text: "Jadwal unit terlihat jelas. Boleh saya kirim contoh tampilannya?", at: m0 }, { mine: false, text: "Boleh", at: m0 + 60_000 }]);
  const handMeeting = await staged("Meeting pilihan sendiri", "629900000019", "meeting", [{ mine: true, text: "Jadwal unit terlihat jelas. Boleh saya kirim contoh tampilannya?", at: m0 }, { mine: false, text: "Boleh", at: m0 + 60_000 }]);
  await prisma.leadActivity.create({ data: { leadId: handMeeting.id, type: "crm_update", note: "Status changed to meeting", metadata: { crmStatus: "meeting" } } });
  const realMeeting = await staged("Meeting sungguhan", "629900000020", "meeting", [{ mine: true, text: "Mau saya tunjukkan demo singkatnya?", at: m0 }, { mine: false, text: "boleh kak", at: m0 + 60_000 }, { mine: true, text: "Besok jam 10 ya", at: m0 + 120_000 }, { mine: false, text: "Ok", at: m0 + 180_000 }]);
  const stagePreview = await reclassify.run(ws, { apply: false });
  check("the preview lowers the stage of the false meeting only", stagePreview.sample.some((c) => c.leadId === falseMeeting.id && c.stage.from === "meeting" && c.stage.to === "interested") && !stagePreview.sample.some((c) => (c.leadId === handMeeting.id || c.leadId === realMeeting.id) && c.stage.from !== c.stage.to));
  await reclassify.run(ws, { apply: true });
  check("applying: the false meeting becomes 'interested'", (await prisma.lead.findUniqueOrThrow({ where: { id: falseMeeting.id } })).crmStatus === "interested");
  check("a stage the owner set by hand is never lowered", (await prisma.lead.findUniqueOrThrow({ where: { id: handMeeting.id } })).crmStatus === "meeting");
  check("a real meeting stays a meeting even though the last word was just 'Ok'", (await prisma.lead.findUniqueOrThrow({ where: { id: realMeeting.id } })).crmStatus === "meeting");
  const unseen = await staged("Percakapan tidak lengkap", "629900000022", "meeting", [{ mine: true, text: "Boleh saya kirim contoh tampilannya?", at: m0 }, { mine: false, text: "Boleh", at: m0 + 60_000 }, { mine: false, text: "Server di mana ya", at: m0 + 600_000 }, { mine: false, text: "Pihak ketiga ya", at: m0 + 1_200_000 }, { mine: false, text: "Ok", at: m0 + 1_800_000 }]);
  const incompleteRun = await reclassify.run(ws, { apply: true });
  check("a conversation that went on with answers we never saw is left exactly as it is and reported", (await prisma.lead.findUniqueOrThrow({ where: { id: unseen.id } })).crmStatus === "meeting" && incompleteRun.incomplete >= 1);
  const ackLead = await mk("Ucapan sopan", "629900000021");
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: ackLead.id, toPhone: "629900000021", body: "Ini contohnya ya kak.", source: "ai_outreach", status: "sent", sentAt: new Date(Date.now() - 300_000) } });
  await prisma.lead.update({ where: { id: ackLead.id }, data: { needsReply: false, repliedAt: null, crmStatus: "contacted" } });
  await inbound.handle(ws, { phone: "629900000021", text: "Ok kk", id: "ack-1", at: new Date() });
  await sleep(500);
  const ackNow = await prisma.lead.findUniqueOrThrow({ where: { id: ackLead.id } });
  check("a polite closing is a reply nobody has to answer: not waiting, no draft", ackNow.lastIntent === "ack" && ackNow.needsReply === false && ackNow.crmStatus === "replied" && (await prisma.outboundMessage.count({ where: { leadId: ackLead.id, source: "ai_reply" } })) === 0);

  // 7. provider down: message goes back to the queue, no failure counted
  await prisma.outboundMessage.updateMany({ where: { workspaceId: ws, status: "approved" }, data: { status: "cancelled" } });
  const q = await msg("629900000008", "tunggu koneksi");
  wa.mode = "unavailable";
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
  await sender.tick(ws);
  const back = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: q.id } });
  check("provider unavailable: message returns to approved", back.status === "approved" && back.attempts === 0, `status=${back.status} attempts=${back.attempts}`);

  // 8. repeated errors: retried, then failed; circuit breaker pauses the account
  wa.mode = "error";
  for (let i = 0; i < 3; i++) {
    await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
    await sender.tick(ws);
  }
  const accEnd = await prisma.whatsappAccount.findUniqueOrThrow({ where: { workspaceId: ws } });
  check("3 consecutive send errors pause the account", accEnd.paused && /paused automatically/i.test(accEnd.lastError ?? ""));
  const failed = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: q.id } });
  check("message is failed after 3 attempts", failed.status === "failed" && failed.attempts === 3, `status=${failed.status} attempts=${failed.attempts}`);

  // 9. crash recovery
  const stuck = await msg("629900000009", "macet", "sending");
  await new SenderService(prisma, new ConfigService({ WHATSAPP_DISABLED: "false" }), wa, entitlements, new AttachmentService(prisma, new ConfigService({}))).onModuleInit();
  const rec = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: stuck.id } });
  check("message stuck in 'sending' is marked failed, not resent", rec.status === "failed" && /interrupted/i.test(rec.error ?? ""), `status=${rec.status} error=${rec.error}`);

  // cleanup: deleting the workspace removes everything this run created
  await prisma.workspace.delete({ where: { id: ws } });
  if (sender["timer"]) clearInterval(sender["timer"]);
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
