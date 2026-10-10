/**
 * Reliability check for the send pipeline against a real database, with a fake WhatsApp provider and a stub writer.
 * Run: DATABASE_URL=... WORKSPACE_ID=... npx tsx scripts/pipeline-check.ts
 * It creates rows for numbers starting with 6299 and removes them at the end.
 */
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { InboundService } from "../src/messaging/inbound.service";
import { SenderService } from "../src/messaging/sender.service";
import { ProviderUnavailableError, type InboundWhatsappMessage, type WhatsappProvider } from "../src/messaging/whatsapp.provider";

const ws = process.env.WORKSPACE_ID!;
const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

class FakeWa implements WhatsappProvider {
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

const stubWriter = { reply: async () => ({ text: "balasan uji", trace: { styled: true, examples: 0, knowledge: "none", model: "stub", latencyMs: 1 } }) } as never;

async function msg(phone: string, body: string, status = "approved", extra: Record<string, unknown> = {}) {
  return prisma.outboundMessage.create({ data: { workspaceId: ws, toPhone: phone, body, source: "ai_outreach", status, approvedAt: new Date(), ...extra } });
}

async function main() {
  await prisma.$connect();
  await prisma.outboundMessage.deleteMany({ where: { workspaceId: ws, toPhone: { startsWith: "6299" } } });
  await prisma.inboundMessage.deleteMany({ where: { workspaceId: ws, fromPhone: { startsWith: "6299" } } });
  await prisma.messageOptOut.deleteMany({ where: { workspaceId: ws, phone: { startsWith: "6299" } } });
  const original = await prisma.whatsappAccount.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws }, update: {} });
  const open = { paused: false, hourlyLimit: 2, dailyLimit: 80, quietStartHour: 0, quietEndHour: 0, nextSendAt: null, lastError: null };
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: open });

  const wa = new FakeWa();
  const sender = new SenderService(prisma, new ConfigService({ WHATSAPP_DISABLED: "false" }), wa);

  // 1. one message per tick, then cooldown
  const a = await msg("629900000001", "satu"); await msg("629900000002", "dua"); await msg("629900000003", "tiga");
  await sender.tick();
  check("sends exactly one message per tick", wa.sent.length === 1 && wa.sent[0].text === "satu");
  await sender.tick();
  check("cooldown blocks the next send", wa.sent.length === 1);
  const acc = await prisma.whatsappAccount.findUniqueOrThrow({ where: { workspaceId: ws } });
  check("nextSendAt is set within 0.6x-1.4x of the 30 min gap", !!acc.nextSendAt && acc.nextSendAt.getTime() - Date.now() > 17 * 60_000 && acc.nextSendAt.getTime() - Date.now() < 43 * 60_000);

  // 2. hourly limit
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
  await sender.tick();
  check("second message goes out after cooldown", wa.sent.length === 2);
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
  await sender.tick();
  check("hourly limit (2) blocks the third", wa.sent.length === 2);
  const third = await prisma.outboundMessage.findFirstOrThrow({ where: { workspaceId: ws, toPhone: "629900000003" } });
  check("blocked message stays approved", third.status === "approved");
  await prisma.outboundMessage.update({ where: { id: third.id }, data: { status: "cancelled" } });

  // 3. quiet hours
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { hourlyLimit: 30, quietStartHour: hour, quietEndHour: (hour + 1) % 24, nextSendAt: null } });
  await msg("629900000004", "malam");
  await sender.tick();
  check("quiet hours hold messages back", wa.sent.length === 2);
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { quietStartHour: 0, quietEndHour: 0 } });

  // 4. number not on WhatsApp: fails, does not trip the breaker
  await prisma.outboundMessage.updateMany({ where: { workspaceId: ws, toPhone: "629900000004" }, data: { status: "cancelled" } });
  await msg("629900009999", "mati");
  await sender.tick();
  const dead = await prisma.outboundMessage.findFirstOrThrow({ where: { workspaceId: ws, toPhone: "629900009999" } });
  check("number not on WhatsApp is marked failed", dead.status === "failed" && /not on whatsapp/i.test(dead.error ?? ""));
  check("a dead number does not pause the account", !(await prisma.whatsappAccount.findUniqueOrThrow({ where: { workspaceId: ws } })).paused);

  // 5. opt-out via inbound STOP
  const inbound = new InboundService(prisma, stubWriter, wa);
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
  await sender.tick();
  check("sender refuses an opted-out number even if approved later", wa.sent.length === before);

  // 6. reply from a known lead: status update, follow-ups cancelled, reply draft prepared
  const lead = await prisma.lead.findFirstOrThrow({ where: { workspaceId: ws } });
  const leadBefore = { phoneE164: lead.phoneE164, crmStatus: lead.crmStatus, repliedAt: lead.repliedAt, contactedAt: lead.contactedAt };
  await prisma.lead.update({ where: { id: lead.id }, data: { phoneE164: "629900000006", crmStatus: "contacted", repliedAt: null } });
  await prisma.outboundMessage.create({ data: { workspaceId: ws, leadId: lead.id, toPhone: "629900000006", body: "fu", source: "ai_followup", status: "draft" } });
  await inbound.handle(ws, { phone: "629900000006", text: "boleh, berapa harganya?", id: "in-reply-1", at: new Date() });
  const l2 = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  check("reply moves the lead to 'replied'", l2.crmStatus === "replied" && !!l2.repliedAt);
  check("pending follow-up is cancelled", (await prisma.outboundMessage.findFirstOrThrow({ where: { leadId: lead.id, source: "ai_followup" } })).status === "cancelled");
  const draft = await prisma.outboundMessage.findFirst({ where: { leadId: lead.id, source: "ai_reply", status: "draft" } });
  check("a reply DRAFT is prepared, nothing is sent", !!draft && wa.sent.length === before);
  const unknownBefore = await prisma.outboundMessage.count({ where: { workspaceId: ws } });
  await inbound.handle(ws, { phone: "629900000077", text: "halo siapa ini", id: "in-unknown-1", at: new Date() });
  check("unknown sender is stored but never answered", (await prisma.outboundMessage.count({ where: { workspaceId: ws } })) === unknownBefore);

  // 7. provider down: message goes back to the queue, no failure counted
  await prisma.outboundMessage.updateMany({ where: { workspaceId: ws, status: "approved" }, data: { status: "cancelled" } });
  const q = await msg("629900000008", "tunggu koneksi");
  wa.mode = "unavailable";
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
  await sender.tick();
  const back = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: q.id } });
  check("provider unavailable: message returns to approved", back.status === "approved" && back.attempts === 0, `status=${back.status} attempts=${back.attempts}`);

  // 8. repeated errors: retried, then failed; circuit breaker pauses the account
  wa.mode = "error";
  for (let i = 0; i < 3; i++) {
    await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { nextSendAt: null } });
    await sender.tick();
  }
  const accEnd = await prisma.whatsappAccount.findUniqueOrThrow({ where: { workspaceId: ws } });
  check("3 consecutive send errors pause the account", accEnd.paused && /paused automatically/i.test(accEnd.lastError ?? ""));
  const failed = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: q.id } });
  check("message is failed after 3 attempts", failed.status === "failed" && failed.attempts === 3, `status=${failed.status} attempts=${failed.attempts}`);

  // 9. crash recovery
  const stuck = await msg("629900000009", "macet", "sending");
  await new SenderService(prisma, new ConfigService({ WHATSAPP_DISABLED: "false" }), wa).onModuleInit();
  const rec = await prisma.outboundMessage.findUniqueOrThrow({ where: { id: stuck.id } });
  check("message stuck in 'sending' is marked failed, not resent", rec.status === "failed" && /interrupted/i.test(rec.error ?? ""));

  // cleanup
  await prisma.outboundMessage.deleteMany({ where: { workspaceId: ws, toPhone: { startsWith: "6299" } } });
  await prisma.inboundMessage.deleteMany({ where: { workspaceId: ws, fromPhone: { startsWith: "6299" } } });
  await prisma.messageOptOut.deleteMany({ where: { workspaceId: ws, phone: { startsWith: "6299" } } });
  await prisma.leadActivity.deleteMany({ where: { leadId: lead.id, type: { in: ["replied", "whatsapp_sent", "opted_out"] } } });
  await prisma.lead.update({ where: { id: lead.id }, data: leadBefore }); // put the lead back exactly as it was (including its real phone)
  await prisma.whatsappAccount.update({ where: { workspaceId: ws }, data: { paused: original.paused, hourlyLimit: original.hourlyLimit, quietStartHour: original.quietStartHour, quietEndHour: original.quietEndHour, nextSendAt: null, lastError: null } });
  if (sender["timer"]) clearInterval(sender["timer"]);
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
