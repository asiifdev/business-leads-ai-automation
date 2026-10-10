import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiClientService } from "../ai/ai-client.service";
import { KnowledgeService } from "../ai/knowledge.service";
import { buildBriefMessages, type BriefPass, type BriefSource } from "./brief-prompt";
import { coerceBrief, extractJson, groundBrief, mergeRaw, type BriefContent, type CampaignSuggestion } from "./brief-schema";
import { PageRenderer } from "./page-renderer";
import { crawlSite, siteToText } from "./site-crawler";
import { validatePublicUrl } from "./url-fetch";

const MAX_FILE_BYTES = 1_000_000;
const MAX_SOURCES_FOR_BRIEF = 8;

export interface GenerateInput {
  sourceIds?: string[];
  notes?: string;
  industry?: string;
  location?: string;
  language?: "indonesian" | "english";
}

export interface BriefView {
  version: number;
  language: string;
  summary: string;
  content: BriefContent;
  campaign?: CampaignSuggestion;
  /** Pages the model actually saw, so the user can judge what the brief is based on. */
  pagesRead: { title: string; url: string }[];
  sources: { id: string; title: string; url: string | null }[];
  updatedAt: Date;
}

const PAGE_HEADER = /^## Halaman: (.*) \((https?:\/\/[^)]+)\)$/gm;
const pagesIn = (text: string) => [...text.matchAll(PAGE_HEADER)].map((m) => ({ title: m[1], url: m[2] }));

@Injectable()
export class BriefService {
  private readonly logger = new Logger(BriefService.name);
  /** Live progress of background reads, by source id. Lost on restart, which is fine: the source row says processing/failed. */
  private readonly progress = new Map<string, { stage: "reading" | "indexing"; pages?: number; discovered?: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly knowledge: KnowledgeService,
    private readonly renderer: PageRenderer,
    private readonly config: ConfigService,
  ) {}

  // ---------- sources ----------

  async listSources(workspaceId: string) {
    const rows = await this.prisma.knowledgeSource.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, kind: true, url: true, status: true, error: true, chunkCount: true, text: true, createdAt: true },
    });
    return rows.map(({ text, ...r }) => ({
      ...r,
      chars: text?.length ?? 0,
      pages: text ? pagesIn(text).length : 0,
      readable: !!text,
      progress: this.progress.get(r.id) ?? null,
    }));
  }

  /** Starts reading a website in the background and returns immediately. Bad addresses are refused up front. */
  async addUrl(workspaceId: string, rawUrl: string, title?: string) {
    const url = validatePublicUrl(rawUrl);
    const source = await this.knowledge.createPending(workspaceId, { title: title?.trim() || url.hostname, kind: "url", url: url.toString() });
    void this.readSite(workspaceId, source.id, url.toString());
    return source;
  }

  private async readSite(workspaceId: string, sourceId: string, url: string) {
    try {
      this.progress.set(sourceId, { stage: "reading" });
      const result = await crawlSite(url, { maxPages: 10, render: (u) => this.renderer.render(u) });
      if (result.pages.length === 0) {
        const why = result.failed[0]?.reason ?? "nothing readable was found";
        throw new Error(`Could not read this site: ${why}. Paste the text instead.`);
      }
      const text = siteToText(result);
      await this.prisma.knowledgeSource.update({ where: { id: sourceId }, data: { text: text.slice(0, 200_000), title: new URL(url).hostname } });
      this.progress.set(sourceId, { stage: "indexing", pages: result.pages.length, discovered: result.discovered });
      this.logger.log(`Read ${result.pages.length}/${result.discovered} pages of ${new URL(url).hostname} (${result.notes.join("; ")})`);
      await this.knowledge.index(workspaceId, sourceId, text);
    } catch (e) {
      const message = (e as Error).message;
      this.logger.warn(`Source ${sourceId} failed: ${message}`);
      const row = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId }, select: { text: true } });
      // when the text was read but indexing failed, keep the source usable for briefs
      await this.prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: row?.text ? "ready" : "failed", error: row?.text ? null : message.slice(0, 300) } }).catch(() => undefined);
    } finally {
      this.progress.delete(sourceId);
    }
  }

  async addText(workspaceId: string, title: string, content: string, kind = "text") {
    return this.knowledge.addText(workspaceId, { title, content, kind });
  }

  async addFile(workspaceId: string, file: { originalname: string; buffer: Buffer }) {
    if (!/\.(md|markdown|txt)$/i.test(file.originalname)) throw new BadRequestException("Upload .md or .txt files. Export other documents to one of those first.");
    if (file.buffer.byteLength > MAX_FILE_BYTES) throw new BadRequestException("File is larger than 1 MB");
    const text = file.buffer.toString("utf-8");
    if (text.includes("\u0000")) throw new BadRequestException("That file is not plain text");
    return this.addText(workspaceId, file.originalname.slice(0, 120), text, "file");
  }

  removeSource(workspaceId: string, id: string) {
    return this.knowledge.remove(workspaceId, id);
  }

  // ---------- brief ----------

  async get(workspaceId: string): Promise<BriefView | null> {
    const b = await this.prisma.marketingBrief.findUnique({ where: { workspaceId } });
    if (!b) return null;
    return this.view(b.version, b.language, b.summary, b.content as unknown as BriefContent & { __campaign?: CampaignSuggestion }, b.sourceIds, b.updatedAt);
  }

  private async view(version: number, language: string, summary: string, stored: BriefContent & { __campaign?: CampaignSuggestion }, sourceIds: string[], updatedAt: Date): Promise<BriefView> {
    const { __campaign, ...content } = stored;
    const sources = sourceIds.length
      ? await this.prisma.knowledgeSource.findMany({ where: { id: { in: sourceIds } }, select: { id: true, title: true, url: true, text: true } })
      : [];
    return {
      version, language, summary, content, campaign: __campaign,
      pagesRead: sources.flatMap((s) => (s.text ? pagesIn(s.text) : [])),
      sources: sources.map(({ id, title, url }) => ({ id, title, url })),
      updatedAt,
    };
  }

  async generate(workspaceId: string, input: GenerateInput): Promise<BriefView> {
    if (!this.ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    const language = input.language === "english" ? "english" : "indonesian";
    const rows = await this.prisma.knowledgeSource.findMany({
      where: { workspaceId, ...(input.sourceIds?.length ? { id: { in: input.sourceIds } } : {}), text: { not: null } },
      orderBy: { createdAt: "desc" },
      take: MAX_SOURCES_FOR_BRIEF,
      select: { id: true, title: true, url: true, text: true },
    });
    const notes = (input.notes ?? "").trim();
    if (rows.length === 0 && notes.length < 30) throw new BadRequestException("Add at least one source (a link, text or a file), or describe your offer in a few sentences.");

    const sources: BriefSource[] = rows.map((r) => ({ title: r.title, url: r.url, text: r.text ?? "" }));
    const budget = Number(this.config.get("BRIEF_SOURCE_CHARS")) || 30_000;
    const started = Date.now();
    const base = { language, notes, industry: input.industry, location: input.location, sources, budget } as const;
    const raws: unknown[] = [];
    const replies: string[] = [];
    const failedPasses: BriefPass[] = [];
    let context = "";
    for (const pass of ["positioning", "evidence", "outreach"] as const) {
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          const reply = await this.ai.chat(buildBriefMessages(base, pass, context), { json: true, temperature: 0.3 });
          replies.push(reply);
          const raw = extractJson(reply);
          raws.push(raw);
          if (pass === "positioning") context = JSON.stringify({ summary: (raw as { summary?: string }).summary, overview: (raw as { overview?: unknown }).overview, audience: (raw as { audience?: unknown }).audience });
          ok = true;
        } catch (e) {
          this.logger.warn(`Brief pass ${pass} attempt ${attempt + 1} failed: ${(e as Error).message}`);
        }
      }
      if (!ok) failedPasses.push(pass);
    }
    if (raws.length === 0) {
      await this.logRun(workspaceId, notes, replies.join("\n---\n"), Date.now() - started, "no usable reply");
      throw new ServiceUnavailableException("The AI could not write the brief. Check its settings, or try a larger model.");
    }
    let parsed;
    try {
      const merged = mergeRaw(raws);
      merged.gaps = [...(merged.gaps as unknown[]), ...failedPasses.map((p) => `[NEED: bagian "${p}" gagal dibuat, jalankan generate ulang]`)];
      parsed = groundBrief(coerceBrief(merged, language), [...sources.map((s) => s.text), notes].join("\n"));
    } catch (e) {
      this.logger.warn(`Brief unusable: ${(e as Error).message}`);
      await this.logRun(workspaceId, notes, replies.join("\n---\n"), Date.now() - started, "unusable reply");
      throw new ServiceUnavailableException("The AI answered in a format that could not be used. Try again, or use a larger model.");
    }
    await this.logRun(workspaceId, notes, replies.join("\n---\n"), Date.now() - started);

    const stored = { ...parsed.content, __campaign: parsed.campaign } as unknown as Prisma.InputJsonValue;
    const previous = await this.prisma.marketingBrief.findUnique({ where: { workspaceId }, select: { version: true } });
    const saved = await this.prisma.marketingBrief.upsert({
      where: { workspaceId },
      create: { workspaceId, version: 1, language, summary: parsed.summary, content: stored, sourceIds: rows.map((r) => r.id) },
      update: { version: (previous?.version ?? 0) + 1, language, summary: parsed.summary, content: stored, sourceIds: rows.map((r) => r.id) },
    });
    return this.view(saved.version, saved.language, saved.summary, saved.content as unknown as BriefContent & { __campaign?: CampaignSuggestion }, saved.sourceIds, saved.updatedAt);
  }

  /** The user's own edit of the summary and the structured sections. Saved as the next version. */
  async save(workspaceId: string, summary: string, content: BriefContent): Promise<BriefView> {
    const existing = await this.prisma.marketingBrief.findUnique({ where: { workspaceId } });
    if (!existing) throw new NotFoundException("Generate a brief first");
    const { summary: s, content: c } = coerceBrief({ summary, ...content });
    const keepCampaign = (existing.content as { __campaign?: CampaignSuggestion }).__campaign;
    const saved = await this.prisma.marketingBrief.update({
      where: { workspaceId },
      data: { version: existing.version + 1, summary: s, content: { ...c, ...(keepCampaign ? { __campaign: keepCampaign } : {}) } as unknown as Prisma.InputJsonValue },
    });
    return this.view(saved.version, saved.language, saved.summary, saved.content as unknown as BriefContent & { __campaign?: CampaignSuggestion }, saved.sourceIds, saved.updatedAt);
  }

  private logRun(workspaceId: string, input: string, output: string, latencyMs: number, error?: string) {
    return this.prisma.aiRun.create({ data: { workspaceId, kind: "brief", model: this.ai.chatModel, input: input.slice(0, 2000), output: output.slice(0, 20000) || null, sourceIds: [], latencyMs, error } }).catch(() => undefined);
  }
}
