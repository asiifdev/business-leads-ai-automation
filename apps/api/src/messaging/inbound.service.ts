import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MessageWriterService } from "./message-writer.service";
import { isOptOut, looksLikeInjection, OPT_OUT_HINT_EN, OPT_OUT_HINT_ID } from "./opt-out";
import { planReplyAction } from "./reply-plan";
import { classifyReply, intentMessages, looksAutomaticByTiming, parseIntent, planReplyOutcome, type ReplyIntent } from "./reply-intent";
import { AiClientService } from "../ai/ai-client.service";
import { normalizePhone } from "./phone";
import { loadConversation } from "./conversation-loader";
import { parseReferrals } from "./wa-text";
import { WHATSAPP_PROVIDER, type InboundWhatsappMessage, type OwnWhatsappMessage, type WhatsappProvider } from "./whatsapp.provider";

/** How long to wait after their last bubble before drafting an answer, so a burst of short messages gets one draft that covers all of it. */
const REPLY_DRAFT_DELAY_MS = 20_000;
/** An answer the owner typed on their phone looks the same as one we sent when the text matches and it was sent this recently. */
const SAME_MESSAGE_WINDOW_MS = 10 * 60_000;

/**
 * What happens when someone writes back: record it, honour STOP, update the lead, stop follow-ups,
 * and prepare a reply DRAFT in the owner's voice. Also what happens when the OWNER writes from their phone: it is recorded, the lead
 * stops waiting for an answer, and drafts that answer something already answered are withdrawn. Nothing is ever sent from here.
 */
@Injectable()
export class InboundService implements OnModuleInit {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: MessageWriterService,
    private readonly ai: AiClientService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: WhatsappProvider,
  ) {}

  async onModuleInit() {
    this.wa.onInbound((workspaceId, msg) => this.handle(workspaceId, msg));
    this.wa.onOwnMessage?.(async (workspaceId, msg) => { await this.handleOwnMessage(workspaceId, msg); });
    await this.backfillLeadPhones().catch((e) => this.logger.warn(`Phone backfill skipped: ${e}`));
    // a draft that was waiting out its delay when the server restarted is not lost
    const t = setTimeout(() => void this.resumePending().catch((e) => this.logger.warn(`Resume skipped: ${e}`)), 30_000);
    t.unref?.();
  }

  private readonly draftTimers = new Map<string, NodeJS.Timeout>();

  /** Leads whose last reply arrived in the past few hours, nobody answered, and no draft was ever made for it. */
  private async resumePending() {
    const leads = await this.prisma.lead.findMany({ where: { needsReply: true, repliedAt: { gte: new Date(Date.now() - 6 * 3_600_000) }, phoneE164: { not: "" } }, select: { id: true, workspaceId: true }, take: 50 });
    for (const l of leads) this.scheduleDraft(l.workspaceId, l.id);
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
    const conv = await this.conversation(workspaceId, lead.id, msg.phone, msg.text);
    const lastSent = await this.prisma.outboundMessage.findFirst({ where: { workspaceId, toPhone: msg.phone, channel: "whatsapp", status: "sent" }, orderBy: { sentAt: "desc" }, select: { sentAt: true, body: true } });
    const lastMine = (lastSent?.body ?? "").replace(OPT_OUT_HINT_ID, "").replace(OPT_OUT_HINT_EN, "").trim();
    const quick = lastSent?.sentAt ? msg.at.getTime() - lastSent.sentAt.getTime() : null;
    const priorInbound = await this.prisma.inboundMessage.count({ where: { workspaceId, fromPhone: msg.phone, providerMessageId: { not: msg.id } } });
    // one bubble can be a shop's greeting; otherwise what they just said is everything written together, read against the thread
    const single = classifyReply(msg.text, { lastMine });
    let intent = single === "auto_reply" ? single : classifyReply(conv.incoming, { lastMine });
    // the rules found nothing: let the model read it against the whole conversation (only for real replies, never automatic ones)
    if (intent === "other" && conv.history) intent = (await this.intentWithAi(workspaceId, conv.history, conv.incoming)) ?? intent;
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
    if (outcome.intent === "referral") {
      const contacts = parseReferrals(conv.incoming);
      await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "referral", note: contacts.length ? contacts.map((c) => `${c.name ?? ""} ${c.phone}`.trim()).join(", ") : msg.text.slice(0, 140), metadata: { contacts: contacts.map((c) => ({ name: c.name, phone: c.phone })) } } });
    }
    // they answered: pending follow-ups no longer make sense
    await this.prisma.outboundMessage.updateMany({ where: { workspaceId, leadId: lead.id, source: "ai_followup", status: { in: ["draft", "approved"] } }, data: { status: "cancelled", error: "Lead replied" } });

    this.scheduleDraft(workspaceId, lead.id);
  }

  /**
   * The owner wrote to a lead from their own phone or WhatsApp Web. It becomes part of the conversation, so the next draft knows
   * what was said, the lead stops waiting for an answer, and drafts that answer something already answered are withdrawn.
   * Only numbers that belong to a lead are kept: any other chat on the phone is ignored and never stored.
   */
  async handleOwnMessage(workspaceId: string, msg: OwnWhatsappMessage): Promise<"recorded" | "ignored"> {
    const lead = await this.prisma.lead.findFirst({ where: { workspaceId, phoneE164: msg.phone }, orderBy: { createdAt: "desc" } });
    if (!lead || !msg.text.trim()) return "ignored";
    const text = msg.text.trim().slice(0, 8000);
    // already known: something Prospex sent itself (the event comes back for our own messages), or this exact message seen before
    const recent = await this.prisma.outboundMessage.findMany({
      where: { workspaceId, channel: "whatsapp", OR: [{ providerMessageId: msg.id }, { toPhone: msg.phone, status: { in: ["approved", "sending", "sent"] }, updatedAt: { gte: new Date(Date.now() - SAME_MESSAGE_WINDOW_MS) } }] }, // updatedAt, not createdAt: a draft approved hours ago is claimed (and its event arrives) now
      select: { providerMessageId: true, body: true },
      take: 30,
    });
    if (recent.some((m) => m.providerMessageId === msg.id || m.body.trim() === text)) return "ignored";

    await this.prisma.outboundMessage.create({
      data: { workspaceId, leadId: lead.id, channel: "whatsapp", toPhone: msg.phone, body: text, source: "external", status: "sent", approvedAt: msg.at, sentAt: msg.at, providerMessageId: msg.id, context: { external: true } },
    });
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { needsReply: false, ...(lead.contactedAt && lead.contactedAt > msg.at ? {} : { contactedAt: msg.at }), ...(lead.crmStatus === "new" ? { crmStatus: "contacted" } : {}) },
    });
    await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "whatsapp_sent_phone", note: text.slice(0, 140) } });
    // drafts that were written for something the owner has now answered by hand are withdrawn
    const withdrawn = await this.prisma.outboundMessage.updateMany({
      where: { workspaceId, leadId: lead.id, source: { in: ["ai_reply", "ai_followup"] }, status: { in: ["draft", "approved"] } },
      data: { status: "cancelled", error: "Answered from the phone" },
    });
    const timer = this.draftTimers.get(`${workspaceId}:${lead.id}`);
    if (timer) { clearTimeout(timer); this.draftTimers.delete(`${workspaceId}:${lead.id}`); }
    this.logger.log(`Own message recorded for ${workspaceId}${withdrawn.count ? `, ${withdrawn.count} draft(s) withdrawn` : ""}`);
    return "recorded";
  }

  /** Waits a moment after the last bubble, then drafts one answer for everything they wrote. A newer bubble restarts the wait. */
  private scheduleDraft(workspaceId: string, leadId: string) {
    const key = `${workspaceId}:${leadId}`;
    const previous = this.draftTimers.get(key);
    if (previous) clearTimeout(previous);
    const delay = Number(process.env.REPLY_DRAFT_DELAY_MS ?? REPLY_DRAFT_DELAY_MS);
    const t = setTimeout(() => {
      this.draftTimers.delete(key);
      this.draftReply(workspaceId, leadId).catch((e) => this.logger.warn(`Reply draft skipped for lead ${leadId}: ${(e as Error).message}`));
    }, delay);
    t.unref?.();
    this.draftTimers.set(key, t);
  }

  /**
   * One draft answering what they last said. Skipped when the owner already answered, or a draft already exists for it.
   * A new draft replaces any older waiting one: an old draft for an old message must never sit next to a newer conversation.
   */
  async draftReply(workspaceId: string, leadId: string): Promise<"drafted" | "answered" | "exists" | "nothing"> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, workspaceId }, include: { campaign: { select: { yourService: true, language: true } } } });
    if (!lead?.phoneE164) return "nothing";
    const phone = lead.phoneE164;
    const waiting = await this.waitingState(workspaceId, leadId, phone);
    if (waiting === "answered" || waiting === "nothing") return waiting;
    const conv = await this.conversation(workspaceId, leadId, phone, "");
    if (!conv.incoming.trim()) return "nothing";
    const lastMine = (await this.prisma.outboundMessage.findFirst({ where: { workspaceId, leadId, channel: "whatsapp", status: "sent" }, orderBy: { sentAt: "desc" }, select: { body: true } }))?.body ?? "";
    const intent = (lead.lastIntent as ReplyIntent | null) ?? classifyReply(conv.incoming, { lastMine });
    const action = planReplyAction(intent, conv.incoming);
    const w = await this.writer.reply(workspaceId, lead, conv.incoming.slice(0, 1000), conv.history, action);
    if (!w) return "nothing"; // nothing to answer
    // the model took a while: the owner may have answered in the meantime
    if ((await this.waitingState(workspaceId, leadId, phone)) !== "waiting") return "answered";
    await this.prisma.$transaction([
      this.prisma.outboundMessage.updateMany({ where: { workspaceId, leadId, source: "ai_reply", status: "draft" }, data: { status: "cancelled", error: "Replaced by a newer draft" } }),
      this.prisma.outboundMessage.create({
        data: { workspaceId, leadId, toPhone: phone, body: w.text, aiBody: w.text, source: "ai_reply", status: "draft", context: { action, incoming: conv.incoming.slice(0, 500), flagged: looksLikeInjection(conv.incoming) || w.risks.length > 0, risks: w.risks, trace: w.trace } },
      }),
    ]);
    return "drafted";
  }

  /** "waiting" = they spoke last and no answer or draft exists for it; "answered" = the owner wrote after them; "exists" = a draft for it is already there. */
  private async waitingState(workspaceId: string, leadId: string, phone: string): Promise<"waiting" | "answered" | "exists" | "nothing"> {
    const newest = await this.prisma.inboundMessage.findFirst({ where: { workspaceId, fromPhone: phone, OR: [{ intent: null }, { intent: { not: "auto_reply" } }] }, orderBy: { receivedAt: "desc" }, select: { receivedAt: true } });
    if (!newest) return "nothing";
    const answered = await this.prisma.outboundMessage.findFirst({ where: { workspaceId, leadId, channel: "whatsapp", status: { in: ["sending", "sent"] }, sentAt: { gt: newest.receivedAt } }, select: { id: true } });
    if (answered) return "answered";
    const sending = await this.prisma.outboundMessage.findFirst({ where: { workspaceId, leadId, channel: "whatsapp", status: "sending", createdAt: { gt: newest.receivedAt } }, select: { id: true } });
    if (sending) return "answered";
    const draft = await this.prisma.outboundMessage.findFirst({ where: { workspaceId, leadId, source: "ai_reply", createdAt: { gt: newest.receivedAt } }, select: { id: true } });
    return draft ? "exists" : "waiting";
  }

  /** Labels a reply the rules left as "other", reading it against the conversation so far. Any failure keeps the rule result. */
  private async intentWithAi(workspaceId: string, context: string, theirs: string): Promise<ReplyIntent | null> {
    try {
      const ai = await this.ai.forWorkspace(workspaceId);
      if (!ai.enabled) return null;
      const label = parseIntent(await ai.chat(intentMessages(context, theirs), { temperature: 0 }));
      return label === "other" ? null : label;
    } catch (e) {
      this.logger.warn(`Intent check skipped: ${(e as Error).message}`);
      return null;
    }
  }

  /** The whole conversation with one lead (both sides, the owner's phone messages included), analysed by `analyzeConversation`. */
  conversation(workspaceId: string, leadId: string, phone: string, latest: string) {
    return loadConversation(this.prisma, workspaceId, leadId, phone, latest);
  }
}
