import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EmailAccount } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decide, nextGapMs, startOfLocalDay } from "../messaging/send-policy";
import { decryptSecret } from "../settings/encryption.util";
import { createTransport, friendlySmtpError } from "./email-transport";
import { authFailure, buildFooter, headerLine, isPermanentSmtpError, signUnsubscribe } from "./email-utils";

const TICK_MS = 20_000;
const MAX_ATTEMPTS = 3;
const BREAKER_FAILURES = 3;

/**
 * Sends approved emails one at a time with the same pacing rules as WhatsApp (hourly and daily caps, quiet hours,
 * random gaps). A message is claimed atomically (approved -> sending) so it can never go out twice.
 */
@Injectable()
export class EmailSenderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailSenderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly failures = new Map<string, number>();

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async onModuleInit() {
    if (this.config.get<string>("EMAIL_DISABLED") === "true") return;
    // Found in "sending" after a restart: the server may have accepted it. Never resend automatically.
    const stuck = await this.prisma.outboundMessage.updateMany({
      where: { channel: "email", status: "sending" },
      data: { status: "failed", error: "Interrupted while sending. Check your sent folder before retrying: it may already have been delivered." },
    });
    if (stuck.count) this.logger.warn(`${stuck.count} email(s) were interrupted mid-send and marked failed`);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const accounts = await this.prisma.emailAccount.findMany({ where: { paused: false, status: "ready" } });
      for (const a of accounts) await this.process(a).catch((e) => this.logger.error(`Email sender failed for ${a.workspaceId}: ${e}`));
    } finally { this.running = false; }
  }

  private publicBase() {
    return (this.config.get<string>("PUBLIC_API_URL") || `http://localhost:${this.config.get<string>("PORT") || 3001}/api`).replace(/\/$/, "");
  }

  private async process(a: EmailAccount) {
    const now = new Date();
    const base = { workspaceId: a.workspaceId, channel: "email", status: "sent" };
    const [sentLastHour, sentToday] = await Promise.all([
      this.prisma.outboundMessage.count({ where: { ...base, sentAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
      this.prisma.outboundMessage.count({ where: { ...base, sentAt: { gte: startOfLocalDay(now, a.timezone) } } }),
    ]);
    const d = decide({ now, timezone: a.timezone, hourlyLimit: a.hourlyLimit, dailyLimit: a.dailyLimit, quietStartHour: a.quietStartHour, quietEndHour: a.quietEndHour, sentLastHour, sentToday, nextSendAt: a.nextSendAt, paused: a.paused });
    if (!d.ok) return;

    const next = await this.prisma.outboundMessage.findFirst({ where: { workspaceId: a.workspaceId, channel: "email", status: "approved" }, orderBy: { approvedAt: "asc" } });
    if (!next) return;
    const claimed = await this.prisma.outboundMessage.updateMany({ where: { id: next.id, status: "approved" }, data: { status: "sending", attempts: { increment: 1 } } });
    if (claimed.count !== 1) return;

    try {
      const to = (next.toEmail ?? "").toLowerCase();
      if (await this.prisma.emailOptOut.findUnique({ where: { workspaceId_email: { workspaceId: a.workspaceId, email: to } } })) {
        await this.prisma.outboundMessage.update({ where: { id: next.id }, data: { status: "cancelled", error: "Recipient opted out" } });
        return;
      }
      const language = (next.context as { language?: string } | null)?.language === "english" ? "english" : "indonesian";
      const url = `${this.publicBase()}/unsubscribe/${signUnsubscribe(a.workspaceId, to, this.config.getOrThrow<string>("JWT_SECRET"))}`;
      const transport = await createTransport(a, decryptSecret(a.passwordEnc, this.config.getOrThrow<string>("ENCRYPTION_KEY")));
      let info;
      try {
        info = await transport.sendMail({
          from: { name: headerLine(a.fromName, 120), address: a.fromEmail },
          to,
          ...(a.replyTo ? { replyTo: a.replyTo } : {}),
          subject: headerLine(next.subject ?? ""),
          text: `${next.body}\n\n${buildFooter({ language, url, fromName: a.fromName, postalAddress: a.postalAddress })}`,
          headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
      } finally { transport.close(); }
      if (info.rejected?.length) {
        await this.prisma.outboundMessage.update({ where: { id: next.id }, data: { status: "failed", error: "The mail server rejected this address" } });
        return; // a bad address says nothing about the account's health
      }
      const at = new Date();
      await this.prisma.outboundMessage.update({ where: { id: next.id }, data: { status: "sent", sentAt: at, providerMessageId: String(info.messageId ?? "").slice(0, 200) || null, error: null } });
      await this.prisma.emailAccount.update({ where: { id: a.id }, data: { nextSendAt: new Date(at.getTime() + nextGapMs(a.hourlyLimit)) } });
      this.failures.delete(a.workspaceId);
      if (next.leadId) {
        await this.prisma.lead.updateMany({ where: { id: next.leadId, crmStatus: "new" }, data: { crmStatus: "contacted" } });
        await this.prisma.lead.update({ where: { id: next.leadId }, data: { contactedAt: at, ...(next.source === "ai_reply" || next.source === "manual" ? { needsReply: false } : {}) } });
        await this.prisma.leadActivity.create({ data: { leadId: next.leadId, type: "email_sent", note: (next.subject ?? "").slice(0, 140), metadata: { messageId: next.id, source: next.source } } });
      }
    } catch (e) {
      await this.onFailure(a, next.id, next.attempts + 1, e);
    }
  }

  private async onFailure(a: EmailAccount, id: string, attempts: number, e: unknown) {
    const message = friendlySmtpError(e);
    this.logger.warn(`Email send failed (attempt ${attempts}/${MAX_ATTEMPTS}): ${message}`);
    if (isPermanentSmtpError(e) && !authFailure(e)) {
      // The server refused this message for good (bad mailbox, rejected content). Not the account's fault.
      await this.prisma.outboundMessage.update({ where: { id }, data: { status: "failed", error: message } });
      return;
    }
    if (authFailure(e)) {
      await this.prisma.outboundMessage.update({ where: { id }, data: { status: "approved", attempts: { decrement: 1 } } });
      await this.prisma.emailAccount.update({ where: { id: a.id }, data: { status: "error", lastError: message } });
      return;
    }
    if (attempts >= MAX_ATTEMPTS) await this.prisma.outboundMessage.update({ where: { id }, data: { status: "failed", error: message } });
    else {
      await this.prisma.outboundMessage.update({ where: { id }, data: { status: "approved", error: message } });
      await this.prisma.emailAccount.update({ where: { id: a.id }, data: { nextSendAt: new Date(Date.now() + 10 * 60_000) } });
    }
    const n = (this.failures.get(a.workspaceId) ?? 0) + 1;
    this.failures.set(a.workspaceId, n);
    if (n >= BREAKER_FAILURES) {
      this.failures.delete(a.workspaceId);
      await this.prisma.emailAccount.update({ where: { id: a.id }, data: { paused: true, lastError: `Paused automatically after ${BREAKER_FAILURES} send failures in a row. Last error: ${message}` } });
      this.logger.error(`Email sending paused for workspace ${a.workspaceId}`);
    }
  }
}
