import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { MessageWriterService } from "./message-writer.service";

/** Days to wait after the last message before follow-up #1, #2, ... Two follow-ups at most, then the lead is left alone. */
export const FOLLOW_UP_DELAYS_DAYS = [3, 5];
const PER_RUN = 20;
const DAY = 86_400_000;

/** Prepares follow-up DRAFTS for leads who were contacted and never answered. A person still approves each one. */
@Injectable()
export class FollowUpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService, private readonly writer: MessageWriterService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>("WHATSAPP_DISABLED") === "true") return;
    this.timer = setInterval(() => void this.runAll(), 60 * 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAll() {
    const accounts = await this.prisma.whatsappAccount.findMany({ select: { workspaceId: true } });
    for (const a of accounts) await this.run(a.workspaceId).catch((e) => this.logger.error(`Follow-ups failed for ${a.workspaceId}: ${e}`));
  }

  async run(workspaceId: string) {
    const now = Date.now();
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId, crmStatus: "contacted", repliedAt: null, phoneE164: { not: "" }, NOT: { phoneE164: null } },
      orderBy: { contactedAt: "asc" },
      take: 200,
      include: { campaign: { select: { yourService: true, language: true } } },
    });
    const optOuts = new Set((await this.prisma.messageOptOut.findMany({ where: { workspaceId }, select: { phone: true } })).map((o) => o.phone));
    let created = 0;
    for (const lead of leads) {
      if (created >= PER_RUN) break;
      const phone = lead.phoneE164!;
      if (optOuts.has(phone)) continue;
      const msgs = await this.prisma.outboundMessage.findMany({ where: { workspaceId, leadId: lead.id, source: { in: ["ai_outreach", "ai_followup", "manual"] } }, orderBy: { createdAt: "desc" } });
      if (msgs.some((m) => ["draft", "approved", "sending"].includes(m.status))) continue; // something is already in flight
      const sent = msgs.filter((m) => m.status === "sent" && m.sentAt);
      if (!sent.length) continue;
      const done = sent.filter((m) => m.source === "ai_followup").length;
      if (done >= FOLLOW_UP_DELAYS_DAYS.length) continue;
      const last = sent[0];
      if (now - last.sentAt!.getTime() < FOLLOW_UP_DELAYS_DAYS[done] * DAY) continue;
      try {
        const number = done + 1;
        const w = await this.writer.outreach(workspaceId, lead, { number, of: FOLLOW_UP_DELAYS_DAYS.length, previousMessage: last.body, daysSince: Math.floor((now - last.sentAt!.getTime()) / DAY) });
        await this.prisma.outboundMessage.create({
          data: { workspaceId, leadId: lead.id, toPhone: phone, body: w.text, aiBody: w.text, source: "ai_followup", status: "draft", context: { followUp: number, flagged: w.risks.length > 0, risks: w.risks, trace: w.trace } },
        });
        created++;
      } catch (e) {
        this.logger.warn(`Follow-up draft skipped for lead ${lead.id}: ${(e as Error).message}`);
      }
    }
    return { created };
  }
}
