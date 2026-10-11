import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { unzipSync } from "fflate";
import { PrismaService } from "../prisma/prisma.service";
import { AiClientService } from "./ai-client.service";
import { anonymize } from "./chat-import/anonymize";
import { buildDraftMessages } from "./chat-import/style-prompt";
import { buildReplyPairs, computeStyleStats, type StyleStats } from "./chat-import/style-stats";
import { parseWhatsAppExport, type ParsedChat } from "./chat-import/whatsapp-export-parser";
import { KnowledgeService } from "./knowledge.service";
import { normalizeDraft } from "./orthography";

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

const MAX_ZIP_ENTRIES = 50;
const MAX_UNZIPPED_BYTES = 50_000_000;
const MAX_EXAMPLES = 1500;
const EXAMPLES_PER_DRAFT = 5;

/** Returns the text of every .txt in the uploads, opening .zip files (WhatsApp exports are zipped). */
export function extractTexts(files: UploadedFile[]): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.originalname)) {
      let total = 0;
      let entries = 0;
      const unzipped = unzipSync(new Uint8Array(f.buffer), {
        filter: (e) => {
          if (!/\.txt$/i.test(e.name) || ++entries > MAX_ZIP_ENTRIES) return false;
          total += e.originalSize;
          if (total > MAX_UNZIPPED_BYTES) throw new BadRequestException("Archive is too large once extracted");
          return true;
        },
      });
      for (const [name, data] of Object.entries(unzipped)) out.push({ name, text: new TextDecoder("utf-8").decode(data) });
    } else if (/\.txt$/i.test(f.originalname)) {
      out.push({ name: f.originalname, text: f.buffer.toString("utf8") });
    }
  }
  if (out.length === 0) throw new BadRequestException("Upload WhatsApp exports as .txt or .zip");
  return out;
}

@Injectable()
export class StyleService {
  private readonly logger = new Logger(StyleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly knowledge: KnowledgeService,
  ) {}

  /** Step 1: look at the exports so the user can say which participant is them. Nothing is stored. */
  inspect(files: UploadedFile[]) {
    return extractTexts(files).map(({ name, text }) => {
      const chat = parseWhatsAppExport(text);
      const times = chat.messages.map((m) => m.at.getTime());
      return {
        file: name,
        messages: chat.messages.length,
        senders: chat.senders.map((s) => ({ name: s, messages: chat.messages.filter((m) => m.sender === s).length })),
        from: times.length ? new Date(Math.min(...times)).toISOString() : null,
        to: times.length ? new Date(Math.max(...times)).toISOString() : null,
        skippedLines: chat.skippedLines,
      };
    });
  }

  /** Step 2: learn the owner's style. Only statistics and anonymized example pairs are stored, never raw chats. */
  async train(workspaceId: string, files: UploadedFile[], me: string) {
    const ai = await this.ai.forWorkspace(workspaceId);
    if (!ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    const chats: ParsedChat[] = extractTexts(files).map((f) => parseWhatsAppExport(f.text)).filter((c) => c.senders.includes(me));
    if (chats.length === 0) throw new BadRequestException(`No chat contains a participant named "${me}"`);

    const mine = chats.flatMap((c) => c.messages);
    const stats = computeStyleStats(mine, me);
    if (stats.messageCount < 30) throw new BadRequestException("Need at least 30 of your own messages to learn a style");

    const pairs = chats
      .flatMap((c) => buildReplyPairs(c.messages, me))
      .map((p) => ({ ...p, incoming: anonymize(p.incoming), reply: anonymize(p.reply) }))
      .filter((p) => p.incoming.length <= 500 && p.reply.length > 1 && p.reply.length <= 500)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, MAX_EXAMPLES);
    if (pairs.length === 0) throw new BadRequestException("No question-and-reply pairs found");

    const vectors = await ai.embed(pairs.map((p) => p.incoming));
    const dims = vectors[0].length;

    await this.prisma.$transaction(async (tx) => {
      await tx.styleProfile.deleteMany({ where: { workspaceId } });
      const profile = await tx.styleProfile.create({
        data: {
          workspaceId, ownerName: me, stats: stats as unknown as Prisma.InputJsonValue, messageCount: stats.messageCount,
          exampleCount: pairs.length, embeddingModel: ai.embeddingModel, dimensions: dims,
        },
      });
      for (let i = 0; i < pairs.length; i++) {
        await tx.$executeRaw`
          INSERT INTO style_examples (id, incoming, reply, "embeddingModel", dimensions, embedding, "workspaceId", "profileId")
          VALUES (${`se_${profile.id}_${i}`}, ${pairs[i].incoming}, ${pairs[i].reply}, ${ai.embeddingModel}, ${dims}, ${`[${vectors[i].join(",")}]`}::vector, ${workspaceId}, ${profile.id})`;
      }
    }, { timeout: 120_000 });
    return this.profile(workspaceId);
  }

  async profile(workspaceId: string) {
    const p = await this.prisma.styleProfile.findUnique({ where: { workspaceId } });
    if (!p) return null;
    return { ownerName: p.ownerName, messageCount: p.messageCount, exampleCount: p.exampleCount, stats: p.stats as unknown as StyleStats, embeddingModel: p.embeddingModel, updatedAt: p.updatedAt };
  }

  async remove(workspaceId: string) {
    const res = await this.prisma.styleProfile.deleteMany({ where: { workspaceId } });
    return { deleted: res.count > 0 };
  }

  /** Finds the owner's real replies to the most similar past messages (pgvector cosine distance). */
  async retrieveExamples(workspaceId: string, profile: { embeddingModel: string; dimensions: number }, text: string) {
    const ai = await this.ai.forWorkspace(workspaceId);
    const [qv] = await ai.embed([text]);
    if (qv.length !== profile.dimensions || ai.embeddingModel !== profile.embeddingModel) {
      throw new BadRequestException("The embedding model changed since training; re-import your chats");
    }
    const dims = Number(profile.dimensions);
    const rows = await this.prisma.$queryRaw<{ incoming: string; reply: string; distance: number }[]>`
      SELECT incoming, reply, (embedding::vector(${Prisma.raw(String(dims))}) <=> ${`[${qv.join(",")}]`}::vector(${Prisma.raw(String(dims))})) AS distance
      FROM style_examples
      WHERE "workspaceId" = ${workspaceId} AND "embeddingModel" = ${profile.embeddingModel} AND dimensions = ${dims}
      ORDER BY distance ASC LIMIT ${EXAMPLES_PER_DRAFT}`;
    return rows.map((r) => ({ incoming: r.incoming, reply: r.reply, similarity: Math.round((1 - Number(r.distance)) * 1000) / 1000 }));
  }

  /**
   * Drafts a reply in the owner's voice and returns the full trace (style used, examples retrieved,
   * facts found) so the user can see why the draft says what it says.
   */
  async draft(workspaceId: string, incoming: string, businessDescription?: string) {
    const ai = await this.ai.forWorkspace(workspaceId);
    if (!ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    const started = Date.now();
    const profile = await this.prisma.styleProfile.findUnique({ where: { workspaceId } });
    if (!profile) throw new NotFoundException("No style profile yet: import your chat exports first");
    const stats = profile.stats as unknown as StyleStats;

    const examples = await this.retrieveExamples(workspaceId, profile, incoming);

    const facts = await this.knowledge.search(workspaceId, incoming);
    const messages = buildDraftMessages({
      businessDescription: businessDescription || "bisnis milik pengguna",
      style: stats,
      examples: examples.map((e) => ({ incoming: e.incoming, reply: e.reply, at: new Date() })),
      knowledge: facts.confidence === "none" ? [] : facts.hits.map((h) => h.content),
      incoming,
    });

    let draft = "";
    let error: string | undefined;
    try {
      draft = await ai.chat(messages);
    } catch (err) {
      this.logger.error("Draft generation failed", err as Error);
      error = "generation failed";
    }
    const latencyMs = Date.now() - started;
    await this.prisma.aiRun.create({
      data: {
        workspaceId, kind: "draft", model: ai.chatModel, input: incoming, output: draft || null,
        sourceIds: facts.hits.map((h) => h.sourceId), confidence: facts.confidence, latencyMs, error,
      },
    });
    if (error) throw new ServiceUnavailableException("The AI provider could not write a draft. Check its settings and try again.");
    return {
      draft: normalizeDraft(draft.trim(), { language: "auto", names: [profile.ownerName] }),
      trace: { style: stats, examples, knowledge: facts, model: ai.chatModel, latencyMs },
    };
  }
}
