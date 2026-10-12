import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Campaign, EmailAccount, Lead } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MessageWriterService } from "../messaging/message-writer.service";
import { MAX_BULK, MAX_EMAIL_BODY, isValidEmail } from "../messaging/messaging.service";
import { inQuietHours, localHour, startOfLocalDay } from "../messaging/send-policy";
import { decryptSecret, encryptSecret } from "../settings/encryption.util";
import { createTransport, friendlySmtpError } from "./email-transport";
import { headerLine } from "./email-utils";

export const MAX_GENERATE = 200;

export interface EmailAccountInput {
  host: string; port: number; secure: boolean; username: string; password?: string;
  fromName: string; fromEmail: string; replyTo?: string | null; postalAddress: string; ctaUrl?: string | null;
  hourlyLimit?: number; dailyLimit?: number; quietStartHour?: number; quietEndHour?: number; timezone?: string; paused?: boolean;
}

export interface EmailGenerationJob {
  running: boolean; total: number; done: number; created: number; failed: number;
  skipped: { noEmail: number; optedOut: number; duplicateAddress: number };
  firstError: string | null; startedAt: Date;
}

type LeadWithCampaign = Lead & { campaign: Pick<Campaign, "yourService" | "language"> };

/** The account as the browser may see it: everything except the password. */
function publicAccount(a: EmailAccount) {
  const { passwordEnc, ...rest } = a;
  return { ...rest, hasPassword: !!passwordEnc };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly jobs = new Map<string, EmailGenerationJob>();

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly writer: MessageWriterService) {}

  private key() { return this.config.getOrThrow<string>("ENCRYPTION_KEY"); }

  async overview(workspaceId: string) {
    const a = await this.prisma.emailAccount.findUnique({ where: { workspaceId } });
    const now = new Date();
    const tz = a?.timezone ?? "Asia/Jakarta";
    const base = { workspaceId, channel: "email" };
    const [sentLastHour, sentToday, drafts, approved, withEmail] = await Promise.all([
      this.prisma.outboundMessage.count({ where: { ...base, status: "sent", sentAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
      this.prisma.outboundMessage.count({ where: { ...base, status: "sent", sentAt: { gte: startOfLocalDay(now, tz) } } }),
      this.prisma.outboundMessage.count({ where: { ...base, status: "draft" } }),
      this.prisma.outboundMessage.count({ where: { ...base, status: "approved" } }),
      this.prisma.lead.count({ where: { workspaceId, email: { not: null }, source: "google_maps", outbound: { none: { channel: "email", source: "ai_outreach", status: { notIn: ["rejected", "cancelled"] } } } } }),
    ]);
    return {
      account: a ? publicAccount(a) : null,
      usage: { sentLastHour, sentToday, drafts, approved, leadsWithEmail: withEmail },
      quietNow: a ? inQuietHours(localHour(now, a.timezone), a.quietStartHour, a.quietEndHour) : false,
      etaHours: a && a.hourlyLimit > 0 ? Math.round((approved / a.hourlyLimit) * 10) / 10 : null,
    };
  }

  async save(workspaceId: string, s: EmailAccountInput) {
    const existing = await this.prisma.emailAccount.findUnique({ where: { workspaceId } });
    if (!s.password && !existing) throw new BadRequestException("A password is required");
    if (!isValidEmail(s.fromEmail)) throw new BadRequestException("The sender address is not a valid email");
    if (s.replyTo && !isValidEmail(s.replyTo)) throw new BadRequestException("The reply-to address is not a valid email");
    if (s.timezone) { try { new Intl.DateTimeFormat("en", { timeZone: s.timezone }); } catch { throw new BadRequestException("Unknown timezone"); } }
    let ctaUrl: string | null = null;
    if (s.ctaUrl?.trim()) {
      try {
        const u = new URL(s.ctaUrl.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
        ctaUrl = u.toString();
      } catch {
        throw new BadRequestException("The link must be a full web address such as https://invly.id");
      }
    }
    const data = {
      ctaUrl,
      host: s.host.trim().toLowerCase(), port: s.port, secure: s.secure, username: s.username.trim(),
      fromName: headerLine(s.fromName, 120), fromEmail: s.fromEmail.trim(), replyTo: s.replyTo?.trim() || null, postalAddress: s.postalAddress.trim(),
      ...(s.hourlyLimit !== undefined ? { hourlyLimit: s.hourlyLimit } : {}), ...(s.dailyLimit !== undefined ? { dailyLimit: s.dailyLimit } : {}),
      ...(s.quietStartHour !== undefined ? { quietStartHour: s.quietStartHour } : {}), ...(s.quietEndHour !== undefined ? { quietEndHour: s.quietEndHour } : {}),
      ...(s.timezone ? { timezone: s.timezone } : {}), ...(s.paused !== undefined ? { paused: s.paused } : {}),
      ...(s.password ? { passwordEnc: encryptSecret(s.password, this.key()) } : {}),
    };
    // Changing the server or the login invalidates the last test; limits and the pause switch do not.
    const connectionChanged = !existing || s.password || existing.host !== data.host || existing.port !== data.port || existing.secure !== data.secure || existing.username !== data.username;
    await this.prisma.emailAccount.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data, passwordEnc: data.passwordEnc! },
      update: { ...data, ...(connectionChanged ? { status: "untested", lastError: null, verifiedAt: null } : {}) },
    });
    return this.overview(workspaceId);
  }

  async remove(workspaceId: string) {
    await this.prisma.emailAccount.deleteMany({ where: { workspaceId } });
    return this.overview(workspaceId);
  }

  /** Logs in to the mail server (no message is sent) and records the result. */
  async test(workspaceId: string) {
    const a = await this.prisma.emailAccount.findUnique({ where: { workspaceId } });
    if (!a) throw new NotFoundException("Set up the email account first");
    try {
      const t = await createTransport(a, decryptSecret(a.passwordEnc, this.key()));
      await t.verify();
      t.close();
      await this.prisma.emailAccount.update({ where: { workspaceId }, data: { status: "ready", lastError: null, verifiedAt: new Date() } });
    } catch (e) {
      const msg = e instanceof BadRequestException ? String(e.message) : friendlySmtpError(e);
      await this.prisma.emailAccount.update({ where: { workspaceId }, data: { status: "error", lastError: msg } });
    }
    return this.overview(workspaceId);
  }

  generationStatus(workspaceId: string) { return this.jobs.get(workspaceId) ?? null; }

  /** Drafts first emails for leads that have an address found on their website. Sends nothing. */
  async startGeneration(workspaceId: string, input: { campaignId?: string; leadIds?: string[]; limit?: number }): Promise<EmailGenerationJob> {
    const running = this.jobs.get(workspaceId);
    if (running?.running) return running;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_GENERATE);
    const candidates = await this.prisma.lead.findMany({
      where: {
        workspaceId, email: { not: null }, source: "google_maps",
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.leadIds?.length ? { id: { in: input.leadIds.slice(0, MAX_BULK) } } : {}),
        outbound: { none: { channel: "email", source: "ai_outreach", status: { notIn: ["rejected", "cancelled"] } } },
      },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }], take: limit * 3,
      include: { campaign: { select: { yourService: true, language: true } } },
    });
    const optOuts = new Set((await this.prisma.emailOptOut.findMany({ where: { workspaceId }, select: { email: true } })).map((o) => o.email));
    const job: EmailGenerationJob = { running: true, total: 0, done: 0, created: 0, failed: 0, skipped: { noEmail: 0, optedOut: 0, duplicateAddress: 0 }, firstError: null, startedAt: new Date() };
    const plan: { lead: LeadWithCampaign; to: string }[] = [];
    const seen = new Set<string>();
    for (const lead of candidates) {
      if (plan.length >= limit) break;
      const to = (lead.email ?? "").trim().toLowerCase();
      if (!isValidEmail(to)) { job.skipped.noEmail++; continue; }
      if (optOuts.has(to)) { job.skipped.optedOut++; continue; }
      if (seen.has(to) || (await this.hasActive(workspaceId, to))) { job.skipped.duplicateAddress++; continue; }
      seen.add(to);
      plan.push({ lead, to });
    }
    job.total = plan.length;
    job.running = plan.length > 0;
    this.jobs.set(workspaceId, job);
    if (plan.length) void this.run(workspaceId, job, plan);
    return job;
  }

  private async run(workspaceId: string, job: EmailGenerationJob, plan: { lead: LeadWithCampaign; to: string }[]) {
    try {
      for (const { lead, to } of plan) {
        try {
          const w = await this.writer.outreach(workspaceId, lead, undefined, "email");
          const language = lead.campaign.language === "english" ? "english" : "indonesian";
          const subject = await this.writer.subjectFor(workspaceId, w.text, language);
          await this.prisma.outboundMessage.create({
            data: { workspaceId, leadId: lead.id, channel: "email", toEmail: to, subject, body: w.text, aiBody: w.text, source: "ai_outreach", status: "draft", context: { language, flagged: w.risks.length > 0, risks: w.risks, trace: w.trace } },
          });
          job.created++;
        } catch (e) {
          job.failed++;
          job.firstError ??= (e as Error).message;
          this.logger.warn(`Email draft failed for lead ${lead.id}: ${(e as Error).message}`);
        }
        job.done++;
        if (job.failed >= 3 && job.created === 0) break;
      }
    } finally { job.running = false; }
  }

  private async hasActive(workspaceId: string, to: string) {
    return (await this.prisma.outboundMessage.count({ where: { workspaceId, channel: "email", toEmail: to, source: "ai_outreach", status: { in: ["draft", "approved", "sending", "sent"] } } })) > 0;
  }

  /** A one-off email written by a person (a test to your own address, a quick note). Still a draft that needs approval. */
  async createManual(workspaceId: string, input: { to: string; subject: string; body: string; leadId?: string }) {
    const to = input.to.trim().toLowerCase();
    if (!isValidEmail(to)) throw new BadRequestException("That email address is not valid");
    const subject = headerLine(input.subject);
    const body = input.body.trim();
    if (!subject) throw new BadRequestException("Subject is empty");
    if (!body) throw new BadRequestException("Message is empty");
    if (body.length > MAX_EMAIL_BODY) throw new BadRequestException(`Message is longer than ${MAX_EMAIL_BODY} characters`);
    if (await this.prisma.emailOptOut.findUnique({ where: { workspaceId_email: { workspaceId, email: to } } })) throw new BadRequestException("This address has opted out and cannot be emailed");
    if (input.leadId && !(await this.prisma.lead.findFirst({ where: { id: input.leadId, workspaceId }, select: { id: true } }))) throw new NotFoundException("Lead not found");
    return this.prisma.outboundMessage.create({
      data: { workspaceId, leadId: input.leadId ?? null, channel: "email", toEmail: to, subject, body, aiBody: null, source: "manual", status: "draft", context: { manual: true, language: "indonesian" } },
    });
  }
}
