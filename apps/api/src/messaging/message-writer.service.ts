import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { Campaign, Lead } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiClientService } from "../ai/ai-client.service";
import { KnowledgeService } from "../ai/knowledge.service";
import { StyleService } from "../ai/style.service";
import { buildDraftMessages, buildOutreachMessages } from "../ai/chat-import/style-prompt";
import type { StyleStats } from "../ai/chat-import/style-stats";
import { draftRisks } from "./draft-risk";
import { neutralGreeting, normalizeDraft } from "../ai/orthography";
import { OPT_OUT_HINT_EN, OPT_OUT_HINT_ID } from "./opt-out";

export interface WrittenMessage {
  text: string;
  trace: { styled: boolean; examples: number; knowledge: string; model: string; latencyMs: number };
  /** Things in the draft a reviewer should double-check (links, prices, discounts...). Empty when nothing stands out. */
  risks: string[];
}

type LeadWithCampaign = Lead & { campaign: Pick<Campaign, "yourService" | "language"> };

/** Models sometimes leave template markers behind; a message with "[Nama Anda]" must never reach a customer. */
const PLACEHOLDER = /\[[^\]\n]{1,40}\]|\{\{[^}]+\}\}/;

function clean(raw: string): string {
  return raw.trim().replace(/^["“”']+|["“”']+$/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

@Injectable()
export class MessageWriterService {
  private readonly logger = new Logger(MessageWriterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly knowledge: KnowledgeService,
    private readonly style: StyleService,
  ) {}

  private async businessDescription(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    return ws?.name ?? "bisnis milik pengguna";
  }

  /** First-contact message, or follow-up number `followUp.number`, in the owner's voice when a style exists. */
  async outreach(workspaceId: string, lead: LeadWithCampaign, followUp?: { number: number; of: number; previousMessage: string; daysSince: number }): Promise<WrittenMessage> {
    if (!this.ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    const started = Date.now();
    const language = lead.campaign.language === "english" ? "english" : "indonesian";
    const profile = await this.prisma.styleProfile.findUnique({ where: { workspaceId } });
    const stats = profile ? (profile.stats as unknown as StyleStats) : undefined;

    let examples: { incoming: string; reply: string; similarity: number }[] = [];
    if (profile) {
      try {
        examples = await this.style.retrieveExamples(workspaceId, profile, `calon pelanggan ${lead.category ?? ""} ${lead.campaign.yourService}`.trim());
      } catch (e) {
        // Stats still apply; only the retrieved examples are skipped (e.g. embedding model changed).
        this.logger.warn(`Style examples skipped: ${(e as Error).message}`);
      }
    }
    const facts = await this.knowledge.search(workspaceId, `${lead.campaign.yourService} ${lead.category ?? ""}`.trim());
    const analysis = lead.aiAnalysis as { recommendation?: string } | null;

    const messages = buildOutreachMessages({
      businessDescription: await this.businessDescription(workspaceId),
      offer: lead.campaign.yourService,
      language,
      lead: {
        name: lead.name, category: lead.category, address: lead.address, rating: lead.rating, reviewCount: lead.reviewCount,
        website: lead.website, hasWebsite: lead.hasWebsite, recommendation: analysis?.recommendation ?? null,
      },
      style: stats,
      examples: examples.map((e) => ({ incoming: e.incoming, reply: e.reply, at: new Date() })),
      knowledge: facts.confidence === "none" ? [] : facts.hits.map((h) => h.content),
      followUp,
    });

    const business = await this.businessDescription(workspaceId);
    const body = await this.generate(workspaceId, followUp ? "followup" : "outreach", `${lead.id}`, messages, facts.hits.map((h) => h.sourceId), facts.confidence, { language, names: [lead.name, business] });
    const hint = language === "english" ? OPT_OUT_HINT_EN : OPT_OUT_HINT_ID;
    return {
      text: `${body.text}\n\n${hint}`,
      risks: draftRisks(body.text, facts.hits.map((h) => h.content)),
      trace: { styled: !!stats, examples: examples.length, knowledge: facts.confidence, model: this.ai.chatModel, latencyMs: Date.now() - started },
    };
  }

  /** Reply to something a known lead just wrote. `history` is the recent thread, oldest first. */
  async reply(workspaceId: string, lead: LeadWithCampaign | null, incoming: string, history: string): Promise<WrittenMessage> {
    if (!this.ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    const started = Date.now();
    const profile = await this.prisma.styleProfile.findUnique({ where: { workspaceId } });
    if (!profile) throw new BadRequestException("No style profile yet");
    let examples: { incoming: string; reply: string; similarity: number }[] = [];
    try {
      examples = await this.style.retrieveExamples(workspaceId, profile, incoming);
    } catch (e) {
      this.logger.warn(`Style examples skipped: ${(e as Error).message}`);
    }
    const facts = await this.knowledge.search(workspaceId, incoming);
    const messages = buildDraftMessages({
      businessDescription: `${await this.businessDescription(workspaceId)}${lead ? `, menawarkan ${lead.campaign.yourService} kepada ${lead.name}` : ""}`,
      style: profile.stats as unknown as StyleStats,
      examples: examples.map((e) => ({ incoming: e.incoming, reply: e.reply, at: new Date() })),
      knowledge: facts.confidence === "none" ? [] : facts.hits.map((h) => h.content),
      incoming,
      history,
    });
    const body = await this.generate(workspaceId, "reply", incoming, messages, facts.hits.map((h) => h.sourceId), facts.confidence, { language: lead?.campaign.language === "english" ? "english" : "auto", names: [...(lead ? [lead.name] : []), await this.businessDescription(workspaceId)] });
    return { text: body.text, risks: draftRisks(body.text, facts.hits.map((h) => h.content)), trace: { styled: true, examples: examples.length, knowledge: facts.confidence, model: this.ai.chatModel, latencyMs: Date.now() - started } };
  }

  private async generate(workspaceId: string, kind: string, input: string, messages: { role: "system" | "user"; content: string }[], sourceIds: string[], confidence: string, norm: { language: "indonesian" | "english" | "auto"; names: string[] }) {
    const started = Date.now();
    let output = "";
    let error: string | undefined;
    try {
      output = normalizeDraft(neutralGreeting(clean(await this.ai.chat(messages))), norm);
      if (!output) error = "empty output";
      else if (PLACEHOLDER.test(output)) error = "output contains a template placeholder";
    } catch (e) {
      this.logger.error(`${kind} generation failed`, e as Error);
      error = "generation failed";
    }
    await this.prisma.aiRun.create({
      data: { workspaceId, kind, model: this.ai.chatModel, input: input.slice(0, 2000), output: output || null, sourceIds, confidence, latencyMs: Date.now() - started, error },
    });
    if (error) throw new ServiceUnavailableException(`Could not write a safe draft (${error})`);
    return { text: output };
  }
}
