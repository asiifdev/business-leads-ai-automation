import { Injectable, Logger } from "@nestjs/common";
import { AiClientService } from "../ai/ai-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { loadConversation } from "./conversation-loader";
import { InboundService } from "./inbound.service";
import { isOptOut } from "./opt-out";
import { classifyReply, intentMessages, parseIntent, planReplyOutcome, STAGE_ORDER, type ReplyIntent } from "./reply-intent";
import { peakOfConversation } from "./stage-peak";

const MAX_LEADS = 500;
const MAX_AI_CALLS = 60;
const MAX_REDRAFTS = 20;
/** This many bubbles from them after our last recorded message means the owner answered from the phone before those were recorded. */
const UNSEEN_ANSWERS_AFTER = 3;
/** Stages the classifier hands out by itself; only these may be corrected downwards. A stage the owner chose by hand is never lowered. */
const AUTO_STAGES = ["replied", "interested", "meeting"];
const rank = (s: string) => STAGE_ORDER.indexOf(s as (typeof STAGE_ORDER)[number]);

export interface ReclassifyChange {
  leadId: string;
  name: string;
  answeredByOwner: boolean;
  intent: { from: string | null; to: string };
  needsReply: { from: boolean; to: boolean };
  stage: { from: string; to: string };
  staleDrafts: number;
  /** Everything they wrote was a shop's automatic message: the lead goes back to "contacted". */
  botOnly: boolean;
  /** They asked us to stop but the number is not blocked yet: it will be. */
  optOut: boolean;
}

export interface ReclassifyResult {
  applied: boolean;
  scanned: number;
  changed: number;
  answeredByOwner: number;
  intentChanged: number;
  stageMoved: number;
  botOnly: number;
  optedOut: number;
  /** Conversations that clearly continued with answers we never saw: left exactly as they are, not guessed at. */
  incomplete: number;
  draftsWithdrawn: number;
  draftsRewritten: number;
  /** The first changes, so the owner can see what would happen (or what happened). */
  sample: ReclassifyChange[];
}

/**
 * Reads every conversation again, as a whole: both sides, the owner's own phone messages, a shop's automatic messages set aside.
 * It corrects what an older or simpler reading got wrong: a lead the owner has already answered is no longer "waiting",
 * the label matches what they actually said, the stage only moves forward, and a draft written for a message that has since
 * been answered or overtaken is withdrawn (and a fresh one written when an answer is still owed).
 */
@Injectable()
export class ReclassifyService {
  private readonly logger = new Logger(ReclassifyService.name);

  constructor(private readonly prisma: PrismaService, private readonly ai: AiClientService, private readonly inbound: InboundService) {}

  /** Did the owner ever change this lead's stage themselves (Lead detail)? Then the stage is theirs and is never lowered. */
  private async stageSetByHand(leadId: string): Promise<boolean> {
    const acts = await this.prisma.leadActivity.findMany({ where: { leadId, type: "crm_update" }, select: { metadata: true }, take: 50 });
    return acts.some((a) => !!(a.metadata as { crmStatus?: string } | null)?.crmStatus);
  }

  async run(workspaceId: string, o: { apply: boolean; useAi?: boolean }): Promise<ReclassifyResult> {
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId, crmStatus: { notIn: ["won", "lost"] }, phoneE164: { not: "" }, NOT: { phoneE164: null }, OR: [{ repliedAt: { not: null } }, { needsReply: true }] },
      select: { id: true, name: true, phoneE164: true, crmStatus: true, lastIntent: true, needsReply: true },
      orderBy: { repliedAt: "desc" },
      take: MAX_LEADS,
    });
    const blocked = new Set((await this.prisma.messageOptOut.findMany({ where: { workspaceId }, select: { phone: true } })).map((o) => o.phone));
    const aiOn = o.useAi !== false && (await this.ai.forWorkspace(workspaceId)).enabled;
    let aiCalls = 0;
    let incomplete = 0;
    const changes: ReclassifyChange[] = [];
    const redraft: string[] = [];
    let withdrawn = 0;

    for (const lead of leads) {
      const conv = await loadConversation(this.prisma, workspaceId, lead.id, lead.phoneE164!);
      const phone = lead.phoneE164!;
      // they asked us to stop (often by answering our own "balas STOP" line inside a sentence) but the number is not blocked
      const stopped = conv.replies.some((r) => isOptOut(r.body)) && !blocked.has(phone);
      // everything they wrote is a shop's automatic message: it was never a reply
      const botOnly = !stopped && conv.replies.length > 0 && lead.crmStatus === "replied" && conv.replies.every((r) => classifyReply(r.body) === "auto_reply");
      if (stopped || botOnly) {
        const pending = await this.prisma.outboundMessage.findMany({ where: { workspaceId, leadId: lead.id, status: { in: ["draft", "approved"] } }, select: { id: true } });
        const special: ReclassifyChange = {
          leadId: lead.id, name: lead.name, answeredByOwner: false, botOnly, optOut: stopped,
          intent: { from: lead.lastIntent, to: stopped ? "not_interested" : "auto_reply" },
          needsReply: { from: lead.needsReply, to: false },
          stage: { from: lead.crmStatus, to: stopped ? "lost" : "contacted" },
          staleDrafts: pending.length,
        };
        changes.push(special);
        withdrawn += pending.length;
        if (!o.apply) continue;
        if (stopped) {
          await this.prisma.messageOptOut.upsert({ where: { workspaceId_phone: { workspaceId, phone } }, create: { workspaceId, phone, reason: "Meminta berhenti (STOP)" }, update: {} });
          await this.prisma.lead.update({ where: { id: lead.id }, data: { crmStatus: "lost", lostReason: "Meminta berhenti (STOP)", needsReply: false, closedAt: new Date(), lastIntent: "not_interested" } });
          await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "opted_out", note: "Ditemukan saat membaca ulang percakapan" } });
          blocked.add(phone);
        } else {
          await this.prisma.lead.update({ where: { id: lead.id }, data: { crmStatus: "contacted", repliedAt: null, needsReply: false, lastIntent: "auto_reply" } });
          await this.prisma.inboundMessage.updateMany({ where: { id: { in: conv.replies.map((r) => r.id) } }, data: { intent: "auto_reply" } });
        }
        if (pending.length) await this.prisma.outboundMessage.updateMany({ where: { id: { in: pending.map((d) => d.id) } }, data: { status: "cancelled", error: stopped ? "Reclassified: they asked to stop" : "Reclassified: only an automatic message" } });
        continue;
      }
      if (conv.newestReply === null) continue; // nobody but a shop's greeting bot wrote: not a conversation to read
      // they kept writing after our last recorded message: the owner answered from the phone before this was recorded, so the
      // conversation cannot be read honestly from here. Leave it exactly as it is instead of guessing from half of it.
      const afterOwn = conv.timeline.filter((m) => !m.mine && !m.auto && m.at > (conv.newestOwn ?? 0)).length;
      if (afterOwn >= UNSEEN_ANSWERS_AFTER) { incomplete++; continue; }
      // what their last words meant, even when the owner has answered since (then `incoming` is empty)
      const theirs = conv.theirLast || conv.incoming;
      let intent: ReplyIntent = classifyReply(theirs, { lastMine: conv.lastMine });
      if (intent === "auto_reply") continue;
      if (intent === "other" && aiOn && conv.history && aiCalls < MAX_AI_CALLS) {
        aiCalls++;
        try {
          const label = parseIntent(await (await this.ai.forWorkspace(workspaceId)).chat(intentMessages(conv.history, theirs), { temperature: 0 }));
          if (label && label !== "other") intent = label;
        } catch (e) {
          this.logger.warn(`Intent check skipped: ${(e as Error).message}`);
        }
      }
      // the rules and the model found nothing in their last words: keep a specific label that was there, never overwrite it with "other"
      if (intent === "other" && lead.lastIntent && lead.lastIntent !== "other") intent = lead.lastIntent as ReplyIntent;
      const outcome = planReplyOutcome(lead.crmStatus, intent);
      const needsReply = conv.answered ? false : outcome.needsReply;
      let stage = outcome.stage ?? lead.crmStatus;
      // the highest stage their words honestly reached, read bubble by bubble against what we had asked
      const peak = peakOfConversation(conv.timeline);
      if (peak.stage && rank(peak.stage) > rank(stage) && ["contacted", ...AUTO_STAGES].includes(stage)) stage = peak.stage;
      // an automatic stage that their words never reached (an old reading took "jadwal" or "CALL" for a meeting) is corrected downwards
      if (peak.stage && AUTO_STAGES.includes(lead.crmStatus) && rank(peak.stage) < rank(lead.crmStatus) && !(await this.stageSetByHand(lead.id))) stage = peak.stage;

      // drafts that answer something already answered, or a message since overtaken by a newer one
      const drafts = await this.prisma.outboundMessage.findMany({ where: { workspaceId, leadId: lead.id, source: { in: ["ai_reply", "ai_followup"] }, status: { in: ["draft", "approved"] } }, select: { id: true, source: true, status: true, createdAt: true } });
      const stale = drafts.filter((d) => conv.answered || (d.source === "ai_reply" && d.status === "draft" && conv.newestReply !== null && d.createdAt.getTime() < conv.newestReply));
      const owesAnswer = !conv.answered && needsReply;

      const change: ReclassifyChange = {
        leadId: lead.id, name: lead.name, answeredByOwner: conv.answered,
        intent: { from: lead.lastIntent, to: intent },
        needsReply: { from: lead.needsReply, to: needsReply },
        stage: { from: lead.crmStatus, to: stage },
        staleDrafts: stale.length,
        botOnly: false,
        optOut: false,
      };
      if (change.intent.from === change.intent.to && change.needsReply.from === change.needsReply.to && change.stage.from === change.stage.to && stale.length === 0) continue;
      changes.push(change);
      withdrawn += stale.length;
      if (!o.apply) continue;

      await this.prisma.lead.update({ where: { id: lead.id }, data: { lastIntent: intent, needsReply, ...(stage !== lead.crmStatus ? { crmStatus: stage } : {}) } });
      if (stale.length) {
        await this.prisma.outboundMessage.updateMany({
          where: { id: { in: stale.map((d) => d.id) } },
          data: { status: "cancelled", error: conv.answered ? "Reclassified: you already answered" : "Reclassified: the conversation moved on" },
        });
      }
      if (owesAnswer && stale.some((d) => d.source === "ai_reply")) redraft.push(lead.id);
    }

    let rewritten = 0;
    for (const leadId of redraft.slice(0, MAX_REDRAFTS)) {
      try {
        if ((await this.inbound.draftReply(workspaceId, leadId)) === "drafted") rewritten++;
      } catch (e) {
        this.logger.warn(`Fresh draft skipped for lead ${leadId}: ${(e as Error).message}`);
      }
    }

    return {
      applied: o.apply,
      scanned: leads.length,
      changed: changes.length,
      answeredByOwner: changes.filter((c) => c.answeredByOwner && c.needsReply.from).length,
      intentChanged: changes.filter((c) => c.intent.from !== c.intent.to).length,
      stageMoved: changes.filter((c) => c.stage.from !== c.stage.to && !c.botOnly && !c.optOut).length,
      incomplete,
      botOnly: changes.filter((c) => c.botOnly).length,
      optedOut: changes.filter((c) => c.optOut).length,
      draftsWithdrawn: withdrawn,
      draftsRewritten: rewritten,
      sample: changes.slice(0, 40),
    };
  }
}
