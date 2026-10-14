import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AttachmentService } from "./attachment.service";
import { CAPTION_LIMIT } from "./attachment-file";
import { maybePreview, previewForText } from "./link-preview";
import { MessageWriterService } from "./message-writer.service";
import { isValidEmail } from "./email-address";
import { normalizePhone } from "./phone";
import { inQuietHours, localHour, startOfLocalDay } from "./send-policy";
import { WHATSAPP_PROVIDER, type RoutedWhatsappProvider } from "./whatsapp.provider";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { fitAllowed, fitLevel } from "./fit-gate";
import { isPublicUnsubscribeBase, unsubscribeBase } from "../email/email-utils";

export const MAX_BODY = 8000; // a sanity ceiling, not a style rule: WhatsApp itself allows far more
export const MAX_EMAIL_BODY = 20000;

export { isValidEmail };
export const MAX_GENERATE = 200;
export const MAX_BULK = 200;

export interface GenerationJob {
  running: boolean;
  total: number;
  done: number;
  created: number;
  failed: number;
  skipped: { noValidPhone: number; optedOut: number; duplicateNumber: number; lowFit: number };
  firstError: string | null;
  startedAt: Date;
}

export interface SettingsInput {
  provider?: "baileys" | "cloud_api";
  hourlyLimit?: number;
  dailyLimit?: number;
  quietStartHour?: number;
  quietEndHour?: number;
  timezone?: string;
  defaultCountryCode?: string;
  paused?: boolean;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: MessageWriterService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: RoutedWhatsappProvider,
    private readonly entitlements: EntitlementsService,
    private readonly attachments: AttachmentService,
  ) {}

  // ---------- account ----------

  account(workspaceId: string) {
    return this.prisma.whatsappAccount.upsert({ where: { workspaceId }, create: { workspaceId }, update: {} });
  }

  async overview(workspaceId: string) {
    const account = await this.account(workspaceId);
    this.wa.use(workspaceId, account.provider);
    const live = this.wa.state(workspaceId);
    const now = new Date();
    const [sentLastHour, sentToday, drafts, approved] = await Promise.all([
      this.prisma.outboundMessage.count({ where: { workspaceId, channel: "whatsapp", status: "sent", source: { not: "external" }, sentAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
      this.prisma.outboundMessage.count({ where: { workspaceId, channel: "whatsapp", status: "sent", source: { not: "external" }, sentAt: { gte: startOfLocalDay(now, account.timezone) } } }),
      this.prisma.outboundMessage.count({ where: { workspaceId, channel: "whatsapp", status: "draft" } }),
      this.prisma.outboundMessage.count({ where: { workspaceId, channel: "whatsapp", status: "approved" } }),
    ]);
    return {
      account: {
        status: live.status !== "disconnected" ? live.status : account.status === "logged_out" ? "logged_out" : "disconnected",
        phone: live.phone ?? account.phone,
        hourlyLimit: account.hourlyLimit,
        dailyLimit: account.dailyLimit,
        quietStartHour: account.quietStartHour,
        quietEndHour: account.quietEndHour,
        timezone: account.timezone,
        defaultCountryCode: account.defaultCountryCode,
        paused: account.paused,
        lastError: account.lastError,
        nextSendAt: account.nextSendAt,
      },
      qr: live.qr,
      provider: account.provider,
      // what this workspace may use: the official API needs the hosted edition, a plan that includes it, and the commercial connector
      cloudApi: { entitled: await this.entitlements.has(workspaceId, "whatsapp.cloud_api"), installed: this.wa.hasCloud(), edition: this.entitlements.edition },
      usage: { sentLastHour, sentToday, drafts, approved },
      quietNow: inQuietHours(localHour(now, account.timezone), account.quietStartHour, account.quietEndHour),
      /** Rough time to clear the approved queue at the configured pace. */
      etaHours: account.hourlyLimit > 0 ? Math.round((approved / account.hourlyLimit) * 10) / 10 : null,
    };
  }

  async connect(workspaceId: string) {
    const account = await this.account(workspaceId);
    await this.assertProviderAllowed(workspaceId, account.provider);
    this.wa.use(workspaceId, account.provider);
    await this.prisma.whatsappAccount.update({ where: { workspaceId }, data: { paused: false, lastError: null } });
    await this.wa.connect(workspaceId);
    return this.overview(workspaceId);
  }

  async disconnect(workspaceId: string, logout: boolean) {
    await this.wa.disconnect(workspaceId, { logout });
    return this.overview(workspaceId);
  }

  /** The official API is a commercial feature: refuse it unless this edition, plan and server provide it. */
  private async assertProviderAllowed(workspaceId: string, provider: string) {
    if (provider !== "cloud_api") return;
    await this.entitlements.assert(workspaceId, "whatsapp.cloud_api");
    if (!this.wa.hasCloud()) throw new BadRequestException("The official WhatsApp connector is not installed on this server. Contact alatpintar.id support.");
  }

  async updateSettings(workspaceId: string, s: SettingsInput) {
    const current = await this.account(workspaceId);
    if (s.provider && s.provider !== current.provider) {
      await this.assertProviderAllowed(workspaceId, s.provider);
      // leave the old connection cleanly before the workspace switches
      this.wa.use(workspaceId, current.provider);
      await this.wa.disconnect(workspaceId).catch(() => undefined);
      this.wa.use(workspaceId, s.provider);
    }
    if (s.timezone) {
      try { new Intl.DateTimeFormat("en", { timeZone: s.timezone }); } catch { throw new BadRequestException("Unknown timezone"); }
    }
    await this.prisma.whatsappAccount.update({ where: { workspaceId }, data: s });
    return this.overview(workspaceId);
  }

  // ---------- outbox ----------

  async list(workspaceId: string, status: string | undefined, limit: number, channel?: string) {
    const where: Prisma.OutboundMessageWhereInput = { workspaceId, ...(channel === "email" || channel === "whatsapp" ? { channel } : {}), ...(status ? { status: { in: status.split(",") } } : {}) };
    const approvedFirst = status?.split(",").includes("approved");
    return this.prisma.outboundMessage.findMany({
      where,
      orderBy: approvedFirst ? { approvedAt: "asc" } : { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        lead: { select: { id: true, name: true, category: true, address: true, score: true, crmStatus: true } },
        attachment: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
      },
    });
  }

  async counts(workspaceId: string, channel?: string) {
    const rows = await this.prisma.outboundMessage.groupBy({ by: ["status"], where: { workspaceId, ...(channel === "email" || channel === "whatsapp" ? { channel } : {}) }, _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  }

  private readonly jobs = new Map<string, GenerationJob>();

  /** Progress of the background drafting job for this workspace (null when none has run since the server started). */
  generationStatus(workspaceId: string): GenerationJob | null {
    return this.jobs.get(workspaceId) ?? null;
  }

  /**
   * Picks leads that have a valid number and were never drafted, then writes their first-contact drafts in the background
   * (a local model needs ~40 s per draft). Returns immediately; poll generationStatus(). Sends nothing.
   */
  async startGeneration(workspaceId: string, input: { campaignId?: string; leadIds?: string[]; limit?: number; includeMedium?: boolean }): Promise<GenerationJob> {
    const running = this.jobs.get(workspaceId);
    if (running?.running) return running;
    const account = await this.account(workspaceId);
    const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_GENERATE);
    const candidates = await this.prisma.lead.findMany({
      where: {
        workspaceId,
        phone: { not: null },
        source: "google_maps", // never draft for test fixtures or leads suspected to be invented
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.leadIds?.length ? { id: { in: input.leadIds.slice(0, MAX_BULK) } } : {}),
        outbound: { none: { source: "ai_outreach", status: { notIn: ["rejected", "cancelled"] } } },
      },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: limit * 3,
      include: { campaign: { select: { yourService: true, language: true } } },
    });
    const optOuts = new Set((await this.prisma.messageOptOut.findMany({ where: { workspaceId }, select: { phone: true } })).map((o) => o.phone));

    const job: GenerationJob = { running: true, total: 0, done: 0, created: 0, failed: 0, skipped: { noValidPhone: 0, optedOut: 0, duplicateNumber: 0, lowFit: 0 }, firstError: null, startedAt: new Date() };
    const plan: { lead: (typeof candidates)[number]; phone: string }[] = [];
    const seen = new Set<string>();
    for (const lead of candidates) {
      if (plan.length >= limit) break;
      if (!fitAllowed(fitLevel(lead.aiAnalysis), !!input.includeMedium)) { job.skipped.lowFit++; continue; }
      const phone = lead.phoneE164 || normalizePhone(lead.phone, account.defaultCountryCode);
      if (!phone) { job.skipped.noValidPhone++; continue; }
      if (optOuts.has(phone)) { job.skipped.optedOut++; continue; }
      if (seen.has(phone) || (await this.hasActive(workspaceId, phone))) { job.skipped.duplicateNumber++; continue; }
      seen.add(phone);
      plan.push({ lead, phone });
    }
    job.total = plan.length;
    job.running = plan.length > 0;
    this.jobs.set(workspaceId, job);
    if (plan.length) void this.runGeneration(workspaceId, job, plan);
    return job;
  }

  private async runGeneration(workspaceId: string, job: GenerationJob, plan: { lead: Parameters<MessageWriterService["outreach"]>[1]; phone: string }[]) {
    try {
      for (const { lead, phone } of plan) {
        try {
          const w = await this.writer.outreach(workspaceId, lead);
          await this.prisma.outboundMessage.create({
            data: { workspaceId, leadId: lead.id, toPhone: phone, body: w.text, aiBody: w.text, source: "ai_outreach", status: "draft", context: { flagged: w.risks.length > 0, risks: w.risks, trace: w.trace } },
          });
          if (!lead.phoneE164) await this.prisma.lead.update({ where: { id: lead.id }, data: { phoneE164: phone } });
          job.created++;
        } catch (e) {
          job.failed++;
          job.firstError ??= (e as Error).message;
          this.logger.warn(`Draft failed for lead ${lead.id}: ${(e as Error).message}`);
        }
        job.done++;
        if (job.failed >= 3 && job.created === 0) break; // the AI provider is probably down: stop burning calls
      }
    } finally {
      job.running = false;
    }
  }

  /** True when this number already has a message waiting or in flight (so two leads sharing a phone are not both contacted). */
  private async hasActive(workspaceId: string, phone: string) {
    return (await this.prisma.outboundMessage.count({ where: { workspaceId, toPhone: phone, status: { in: ["draft", "approved", "sending", "sent"] }, source: "ai_outreach" } })) > 0;
  }

  /** A one-off message written by a person (a test, a quick note). It is a draft like any other and still needs approval. */
  async createManual(workspaceId: string, input: { phone: string; body: string; leadId?: string; attachmentId?: string; linkPreview?: boolean }) {
    const account = await this.account(workspaceId);
    const phone = normalizePhone(input.phone, account.defaultCountryCode);
    if (!phone) throw new BadRequestException("That phone number is not valid");
    const body = input.body.trim();
    if (!body) throw new BadRequestException("Message is empty");
    if (body.length > MAX_BODY) throw new BadRequestException(`Message is longer than ${MAX_BODY} characters`);
    if (await this.prisma.messageOptOut.findUnique({ where: { workspaceId_phone: { workspaceId, phone } } })) {
      throw new BadRequestException("This number has opted out and cannot be messaged");
    }
    if (input.leadId && !(await this.prisma.lead.findFirst({ where: { id: input.leadId, workspaceId }, select: { id: true } }))) throw new NotFoundException("Lead not found");
    if (input.attachmentId) await this.attachments.owned(workspaceId, input.attachmentId);
    // a file is sent with the text as its caption, and WhatsApp shows no link card on a caption
    const card = await maybePreview(body, input.linkPreview, !!input.attachmentId && body.length <= CAPTION_LIMIT);
    return this.prisma.outboundMessage.create({
      data: { workspaceId, leadId: input.leadId ?? null, toPhone: phone, body, aiBody: null, source: "manual", status: "draft", context: { manual: true }, attachmentId: input.attachmentId ?? null, ...(card ? { linkPreview: card as unknown as Prisma.InputJsonValue } : {}) },
    });
  }

  async edit(workspaceId: string, id: string, body: string, subject?: string, extras: { attachmentId?: string | null; linkPreview?: boolean } = {}) {
    const text = body.trim();
    if (!text) throw new BadRequestException("Message is empty");
    const m = await this.owned(workspaceId, id);
    const max = m.channel === "email" ? MAX_EMAIL_BODY : MAX_BODY;
    if (text.length > max) throw new BadRequestException(`Message is longer than ${max} characters`);
    if (m.status !== "draft") throw new BadRequestException("Only drafts can be edited");
    const sub = m.channel === "email" && subject !== undefined ? subject.trim().replace(/[\r\n]+/g, " ").slice(0, 200) : undefined;
    if (sub === "") throw new BadRequestException("Subject is empty");
    if (m.channel === "email" && (extras.attachmentId || extras.linkPreview)) throw new BadRequestException("Attachments and link previews are only for WhatsApp messages");
    const attachmentId = extras.attachmentId === undefined ? m.attachmentId : extras.attachmentId;
    if (attachmentId && attachmentId !== m.attachmentId) await this.attachments.owned(workspaceId, attachmentId);
    let linkPreview: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
    if ((attachmentId && text.length <= CAPTION_LIMIT) || extras.linkPreview === false) linkPreview = Prisma.DbNull; // a caption shows no card; "off" removes it
    else if (extras.linkPreview) linkPreview = (await previewForText(text)) as unknown as Prisma.InputJsonValue;
    else if (!m.linkPreview && text !== m.body) {
      // automatic: a link that was just written gets its card
      const auto = await maybePreview(text, undefined, !!attachmentId && text.length <= CAPTION_LIMIT);
      if (auto) linkPreview = auto as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.outboundMessage.update({
      where: { id },
      data: { body: text, ...(sub ? { subject: sub } : {}), ...(extras.attachmentId !== undefined ? { attachmentId: extras.attachmentId } : {}), ...(linkPreview !== undefined ? { linkPreview } : {}), editedByUser: text !== (m.aiBody ?? "") || (!!sub && sub !== m.subject) },
    });
  }

  async approve(workspaceId: string, ids: string[]) {
    const account = await this.account(workspaceId);
    const msgs = await this.prisma.outboundMessage.findMany({ where: { workspaceId, id: { in: ids.slice(0, MAX_BULK) }, status: "draft" } });
    const optOuts = new Set((await this.prisma.messageOptOut.findMany({ where: { workspaceId }, select: { phone: true } })).map((o) => o.phone));
    const mailOptOuts = new Set((await this.prisma.emailOptOut.findMany({ where: { workspaceId }, select: { email: true } })).map((o) => o.email));
    const mailAccount = msgs.some((m) => m.channel === "email") ? await this.prisma.emailAccount.findUnique({ where: { workspaceId } }) : null;
    const ok: string[] = [];
    const rejected: { id: string; reason: string }[] = [];
    for (const m of msgs) {
      if (m.channel === "email") {
        const to = (m.toEmail ?? "").trim().toLowerCase();
        if (!mailAccount) rejected.push({ id: m.id, reason: "email account is not set up" });
        else if (!isValidEmail(to)) rejected.push({ id: m.id, reason: "invalid email address" });
        else if (mailOptOuts.has(to)) rejected.push({ id: m.id, reason: "recipient opted out" });
        else if (!isPublicUnsubscribeBase(unsubscribeBase())) rejected.push({ id: m.id, reason: "PUBLIC_API_URL is not a public https address, so the unsubscribe link would not work" });
        else if (!m.subject?.trim() || !m.body.trim() || m.body.length > MAX_EMAIL_BODY) rejected.push({ id: m.id, reason: "invalid text" });
        else ok.push(m.id);
        continue;
      }
      if (!normalizePhone(m.toPhone, account.defaultCountryCode)) rejected.push({ id: m.id, reason: "invalid number" });
      else if (optOuts.has(m.toPhone)) rejected.push({ id: m.id, reason: "recipient opted out" });
      else if (!m.body.trim() || m.body.length > MAX_BODY) rejected.push({ id: m.id, reason: "invalid text" });
      else ok.push(m.id);
    }
    if (ok.length) await this.prisma.outboundMessage.updateMany({ where: { id: { in: ok }, workspaceId, status: "draft" }, data: { status: "approved", approvedAt: new Date(), error: null } });
    return { approved: ok.length, rejected };
  }

  async reject(workspaceId: string, ids: string[]) {
    const r = await this.prisma.outboundMessage.updateMany({ where: { workspaceId, id: { in: ids.slice(0, MAX_BULK) }, status: "draft" }, data: { status: "rejected" } });
    return { rejected: r.count };
  }

  /** Takes approved messages back out of the queue (they become cancelled, not drafts, so nothing re-enters by accident). */
  async cancel(workspaceId: string, ids: string[]) {
    const r = await this.prisma.outboundMessage.updateMany({ where: { workspaceId, id: { in: ids.slice(0, MAX_BULK) }, status: { in: ["approved", "draft"] } }, data: { status: "cancelled" } });
    return { cancelled: r.count };
  }

  async retry(workspaceId: string, id: string) {
    const m = await this.owned(workspaceId, id);
    if (m.status !== "failed") throw new BadRequestException("Only failed messages can be retried");
    if (/not on whatsapp|opted out|rejected this address|recipients were rejected/i.test(m.error ?? "")) throw new BadRequestException("This number cannot be messaged");
    return this.prisma.outboundMessage.update({ where: { id }, data: { status: "approved", approvedAt: new Date(), error: null, attempts: 0 } });
  }

  /** Conversation with one lead, oldest first: what was sent and what came back. */
  async thread(workspaceId: string, leadId: string) {
    const [out, inn] = await Promise.all([
      this.prisma.outboundMessage.findMany({ where: { workspaceId, leadId, status: "sent" }, select: { id: true, body: true, sentAt: true, source: true } }),
      this.prisma.inboundMessage.findMany({ where: { workspaceId, leadId }, select: { id: true, body: true, receivedAt: true } }),
    ]);
    return [
      ...out.map((m) => ({ id: m.id, direction: "out" as const, body: m.body, at: m.sentAt!, source: m.source })),
      ...inn.map((m) => ({ id: m.id, direction: "in" as const, body: m.body, at: m.receivedAt, source: "customer" })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private async owned(workspaceId: string, id: string) {
    const m = await this.prisma.outboundMessage.findFirst({ where: { id, workspaceId } });
    if (!m) throw new NotFoundException("Message not found");
    return m;
  }
}
