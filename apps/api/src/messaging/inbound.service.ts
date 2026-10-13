import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MessageWriterService } from "./message-writer.service";
import { isOptOut, looksLikeInjection } from "./opt-out";
import { planReplyAction } from "./reply-plan";
import { classifyReply, looksAutomaticByTiming, planReplyOutcome } from "./reply-intent";
import { normalizePhone } from "./phone";
import { WHATSAPP_PROVIDER, type InboundWhatsappMessage, type WhatsappProvider } from "./whatsapp.provider";

/**
 * What happens when someone writes back: record it, honour STOP, update the lead, stop follow-ups,
 * and prepare a reply DRAFT in the owner's voice. Nothing is ever sent from here.
 */
@Injectable()
export class InboundService implements OnModuleInit {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: MessageWriterService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: WhatsappProvider,
  ) {}

  async onModuleInit() {
    this.wa.onInbound((workspaceId, msg) => this.handle(workspaceId, msg));
    await this.backfillLeadPhones().catch((e) => this.logger.warn(`Phone backfill skipped: ${e}`));
  }

  /** Leads scraped before phoneE164 existed get it once, so replies can be matched to them. */
  private async backfillLeadPhones() {
    for (let i = 0; i < 20; i++) {
      const rows = await this.prisma.lead.findMany({ where: { phoneE164: null, phone: { not: null } }, select: { id: true, phone: true }, take: 500 });
      if (!rows.length) return;
      for (const r of rows) {
        // an unparseable number gets "" so it is not picked up again
        await this.prisma.lead.update({ where: { id: r.id }, data: { phoneE164: normalizePhone(r.phone) ?? "" } });
      }
    }
  }

  async handle(workspaceId: string, msg: InboundWhatsappMessage) {
    const lead = await this.prisma.lead.findFirst({ where: { workspaceId, phoneE164: msg.phone }, orderBy: { createdAt: "desc" }, include: { campaign: { select: { yourService: true, language: true } } } });
    try {
      await this.prisma.inboundMessage.create({ data: { workspaceId, leadId: lead?.id, fromPhone: msg.phone, body: msg.text.slice(0, 4000), providerMessageId: msg.id, receivedAt: msg.at } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; // already processed
      throw e;
    }

    if (isOptOut(msg.text)) {
      await this.prisma.messageOptOut.upsert({ where: { workspaceId_phone: { workspaceId, phone: msg.phone } }, create: { workspaceId, phone: msg.phone, reason: msg.text.slice(0, 200) }, update: {} });
      await this.prisma.outboundMessage.updateMany({ where: { workspaceId, toPhone: msg.phone, status: { in: ["draft", "approved"] } }, data: { status: "cancelled", error: "Recipient opted out" } });
      if (lead) {
        await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "opted_out", note: msg.text.slice(0, 140) } });
        // an explicit STOP is the one reply that closes a deal by itself
        if (!["won", "lost"].includes(lead.crmStatus)) {
          await this.prisma.lead.update({ where: { id: lead.id }, data: { crmStatus: "lost", lostReason: "Meminta berhenti (STOP)", needsReply: false, closedAt: new Date(), repliedAt: msg.at } });
        }
      }
      this.logger.log(`Opt-out recorded for ${workspaceId}`);
      return;
    }
    if (!lead) return; // unknown sender: stored, never auto-answered

    // seconds after our message and no clear question: a shop's greeting bot, not a person
    const lastSent = await this.prisma.outboundMessage.findFirst({ where: { workspaceId, toPhone: msg.phone, channel: "whatsapp", status: "sent" }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
    const quick = lastSent?.sentAt ? msg.at.getTime() - lastSent.sentAt.getTime() : null;
    const priorInbound = await this.prisma.inboundMessage.count({ where: { workspaceId, fromPhone: msg.phone, providerMessageId: { not: msg.id } } });
    const intent = classifyReply(msg.text);
    const outcome = planReplyOutcome(lead.crmStatus, priorInbound === 0 && intent !== "auto_reply" && looksAutomaticByTiming(msg.text, quick) ? "auto_reply" : intent);
    await this.prisma.inboundMessage.updateMany({ where: { workspaceId, providerMessageId: msg.id }, data: { intent: outcome.intent } });
    if (outcome.intent === "auto_reply") {
      await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "auto_reply", note: msg.text.slice(0, 140) } });
      return; // not a person: no stage change, follow-ups stay, no draft
    }
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        repliedAt: msg.at,
        needsReply: outcome.needsReply,
        lastIntent: outcome.intent,
        ...(outcome.stage ? { crmStatus: outcome.stage } : {}),
        ...(outcome.followUpInDays ? { followUpDate: new Date(msg.at.getTime() + outcome.followUpInDays * 86_400_000) } : {}),
      },
    });
    await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "replied", note: msg.text.slice(0, 140), metadata: { intent: outcome.intent, stage: outcome.stage } } });
    // they answered: pending follow-ups no longer make sense
    await this.prisma.outboundMessage.updateMany({ where: { workspaceId, leadId: lead.id, source: "ai_followup", status: { in: ["draft", "approved"] } }, data: { status: "cancelled", error: "Lead replied" } });

    const pending = await this.prisma.outboundMessage.count({ where: { workspaceId, leadId: lead.id, source: "ai_reply", status: "draft" } });
    if (pending > 0) return;
    try {
      const history = await this.history(workspaceId, lead.id, msg.phone);
      const incoming = msg.text.slice(0, 1000); // bound what reaches the model
      const action = planReplyAction(outcome.intent, msg.text);
      const w = await this.writer.reply(workspaceId, lead, incoming, history, action);
      if (!w) return; // nothing to answer
      await this.prisma.outboundMessage.create({
        data: { workspaceId, leadId: lead.id, toPhone: msg.phone, body: w.text, aiBody: w.text, source: "ai_reply", status: "draft", context: { action: planReplyAction(outcome.intent, msg.text), incoming: msg.text.slice(0, 500), flagged: looksLikeInjection(msg.text) || w.risks.length > 0, risks: w.risks, trace: w.trace } },
      });
    } catch (e) {
      this.logger.warn(`Reply draft skipped for lead ${lead.id}: ${(e as Error).message}`);
    }
  }

  private async history(workspaceId: string, leadId: string, phone: string) {
    const [out, inn] = await Promise.all([
      this.prisma.outboundMessage.findMany({ where: { workspaceId, leadId, status: "sent" }, orderBy: { sentAt: "desc" }, take: 5, select: { body: true, sentAt: true } }),
      this.prisma.inboundMessage.findMany({ where: { workspaceId, fromPhone: phone }, orderBy: { receivedAt: "desc" }, take: 6, select: { body: true, receivedAt: true } }),
    ]);
    const lines = [
      ...out.map((m) => ({ at: m.sentAt!.getTime(), line: `Saya: ${m.body}` })),
      ...inn.map((m) => ({ at: m.receivedAt.getTime(), line: `Mereka: ${m.body}` })),
    ].sort((a, b) => a.at - b.at);
    // the newest inbound is passed separately as "incoming"; drop it from the history
    return lines.slice(0, -1).slice(-6).map((l) => l.line).join("\n");
  }
}
