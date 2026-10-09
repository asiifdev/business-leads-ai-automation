import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WhatsappAccount } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decide, nextGapMs, startOfLocalDay, typingDelayMs } from "./send-policy";
import { ProviderUnavailableError, WHATSAPP_PROVIDER, type WhatsappProvider } from "./whatsapp.provider";

const TICK_MS = 15_000;
const MAX_ATTEMPTS = 3;
const BREAKER_FAILURES = 3;

/**
 * Sends approved messages one at a time. Rate, quiet hours and daily cap come from the account settings.
 * A message is claimed atomically (approved -> sending) so it can never go out twice.
 */
@Injectable()
export class SenderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SenderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly consecutiveFailures = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(WHATSAPP_PROVIDER) private readonly wa: WhatsappProvider,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>("WHATSAPP_DISABLED") === "true") return;
    // A message stuck in "sending" means the process died mid-send. It may have been delivered, so never auto-retry it.
    const stuck = await this.prisma.outboundMessage.updateMany({
      where: { status: "sending" },
      data: { status: "failed", error: "Interrupted while sending. Check WhatsApp before retrying: it may already have been delivered." },
    });
    if (stuck.count) this.logger.warn(`${stuck.count} message(s) were interrupted mid-send and marked failed`);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const accounts = await this.prisma.whatsappAccount.findMany({ where: { paused: false } });
      for (const a of accounts) {
        if (this.wa.state(a.workspaceId).status !== "connected") continue;
        await this.process(a).catch((e) => this.logger.error(`Sender failed for ${a.workspaceId}: ${e}`));
      }
    } finally {
      this.running = false;
    }
  }

  private async process(a: WhatsappAccount) {
    const now = new Date();
    const [sentLastHour, sentToday] = await Promise.all([
      this.prisma.outboundMessage.count({ where: { workspaceId: a.workspaceId, status: "sent", sentAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
      this.prisma.outboundMessage.count({ where: { workspaceId: a.workspaceId, status: "sent", sentAt: { gte: startOfLocalDay(now, a.timezone) } } }),
    ]);
    const d = decide({ now, timezone: a.timezone, hourlyLimit: a.hourlyLimit, dailyLimit: a.dailyLimit, quietStartHour: a.quietStartHour, quietEndHour: a.quietEndHour, sentLastHour, sentToday, nextSendAt: a.nextSendAt, paused: a.paused });
    if (!d.ok) return;

    const next = await this.prisma.outboundMessage.findFirst({ where: { workspaceId: a.workspaceId, status: "approved" }, orderBy: { approvedAt: "asc" } });
    if (!next) return;
    const claimed = await this.prisma.outboundMessage.updateMany({ where: { id: next.id, status: "approved" }, data: { status: "sending", attempts: { increment: 1 } } });
    if (claimed.count !== 1) return;

    try {
      const optedOut = await this.prisma.messageOptOut.findUnique({ where: { workspaceId_phone: { workspaceId: a.workspaceId, phone: next.toPhone } } });
      if (optedOut) {
        await this.prisma.outboundMessage.update({ where: { id: next.id }, data: { status: "cancelled", error: "Recipient opted out" } });
        return;
      }
      const jid = await this.wa.resolve(a.workspaceId, next.toPhone);
      if (!jid) {
        await this.prisma.outboundMessage.update({ where: { id: next.id }, data: { status: "failed", error: "Number is not on WhatsApp" } });
        return; // a dead number says nothing about the account's health
      }
      const providerId = await this.wa.send(a.workspaceId, jid, next.body, typingDelayMs(next.body.length));
      const at = new Date();
      await this.prisma.outboundMessage.update({ where: { id: next.id }, data: { status: "sent", sentAt: at, providerMessageId: providerId, error: null } });
      await this.prisma.whatsappAccount.update({ where: { id: a.id }, data: { nextSendAt: new Date(at.getTime() + nextGapMs(a.hourlyLimit)) } });
      this.consecutiveFailures.delete(a.workspaceId);
      if (next.leadId) {
        await this.prisma.lead.updateMany({ where: { id: next.leadId, crmStatus: "new" }, data: { crmStatus: "contacted" } });
        await this.prisma.lead.update({ where: { id: next.leadId }, data: { contactedAt: at } });
        await this.prisma.leadActivity.create({ data: { leadId: next.leadId, type: "whatsapp_sent", note: next.body.slice(0, 140), metadata: { messageId: next.id, source: next.source } } });
      }
    } catch (e) {
      await this.onFailure(a, next.id, next.attempts + 1, e);
    }
  }

  private async onFailure(a: WhatsappAccount, id: string, attempts: number, e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof ProviderUnavailableError) {
      // Not the message's fault: put it back and wait for the connection.
      await this.prisma.outboundMessage.update({ where: { id }, data: { status: "approved", attempts: { decrement: 1 } } });
      return;
    }
    this.logger.warn(`Send failed (attempt ${attempts}/${MAX_ATTEMPTS}): ${message}`);
    if (attempts >= MAX_ATTEMPTS) await this.prisma.outboundMessage.update({ where: { id }, data: { status: "failed", error: message.slice(0, 300) } });
    else {
      await this.prisma.outboundMessage.update({ where: { id }, data: { status: "approved", error: message.slice(0, 300) } });
      await this.prisma.whatsappAccount.update({ where: { id: a.id }, data: { nextSendAt: new Date(Date.now() + 5 * 60_000) } });
    }
    const n = (this.consecutiveFailures.get(a.workspaceId) ?? 0) + 1;
    this.consecutiveFailures.set(a.workspaceId, n);
    if (n >= BREAKER_FAILURES) {
      this.consecutiveFailures.delete(a.workspaceId);
      await this.prisma.whatsappAccount.update({ where: { id: a.id }, data: { paused: true, lastError: `Paused automatically after ${BREAKER_FAILURES} send failures in a row. Last error: ${message.slice(0, 160)}` } });
      this.logger.error(`Sending paused for workspace ${a.workspaceId}`);
    }
  }
}
