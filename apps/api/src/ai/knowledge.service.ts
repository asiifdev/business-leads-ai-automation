import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiClientService } from "./ai-client.service";
import { assertOwnerOrAdmin } from "../auth/roles";
import { chunkText } from "./text-chunker";

export type Confidence = "high" | "low" | "none";
export interface KnowledgeHit {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  similarity: number;
}

// Cosine-similarity thresholds, two tiers (the pattern that works in production in
// hikam-shughro-app): answer normally on "high", say the match is weak on "low",
// and refuse to answer from knowledge on "none". Tune per embedding model.
const HIGH_SIMILARITY = 0.45;
const LOW_SIMILARITY = 0.3;
const TOP_K = 8;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
  ) {}

  list(workspaceId: string) {
    return this.prisma.knowledgeSource.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, kind: true, status: true, chunkCount: true, error: true, createdAt: true },
    });
  }

  async remove(workspaceId: string, id: string) {
    const res = await this.prisma.knowledgeSource.deleteMany({ where: { id, workspaceId } });
    if (res.count === 0) throw new NotFoundException("Knowledge source not found");
    return { deleted: true };
  }

  /** Creates a source row without indexing it yet (used when reading the content takes a while, e.g. crawling a site). */
  createPending(workspaceId: string, input: { title: string; kind: string; url?: string }) {
    return this.prisma.knowledgeSource.create({
      data: { workspaceId, title: input.title, kind: input.kind, url: input.url ?? null, status: "processing" },
      select: { id: true, title: true, kind: true, url: true, status: true },
    });
  }

  async addText(workspaceId: string, input: { title: string; content: string; kind?: string; url?: string }) {
    const ai = await this.ai.forWorkspace(workspaceId);
    if (!ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    if (chunkText(input.content).length === 0) throw new NotFoundException("No text to index");
    const source = await this.prisma.knowledgeSource.create({
      data: { workspaceId, title: input.title, kind: input.kind ?? "text", url: input.url ?? null, text: input.content.slice(0, 400_000), status: "processing" },
    });
    return this.index(workspaceId, source.id, input.content);
  }

  /** Chunks, embeds and stores the text of an existing source, then marks it ready (or failed). */
  async index(workspaceId: string, sourceId: string, content: string) {
    const ai = await this.ai.forWorkspace(workspaceId);
    const source = { id: sourceId };
    const chunks = chunkText(content);
    try {
      if (chunks.length === 0) throw new Error("no text to index");
      const vectors = await ai.embed(chunks);
      const dims = vectors[0].length;
      await this.prisma.knowledgeChunk.deleteMany({ where: { sourceId, workspaceId } });
      for (let i = 0; i < chunks.length; i++) {
        const id = `kc_${source.id}_${i}`;
        await this.prisma.$executeRaw`
          INSERT INTO knowledge_chunks (id, content, position, "embeddingModel", dimensions, embedding, "workspaceId", "sourceId")
          VALUES (${id}, ${chunks[i]}, ${i}, ${ai.embeddingModel}, ${dims}, ${toVector(vectors[i])}::vector, ${workspaceId}, ${source.id})`;
      }
      return this.prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "ready", chunkCount: chunks.length, error: null },
        select: { id: true, title: true, status: true, chunkCount: true },
      });
    } catch (err) {
      // Provider errors can contain internal URLs, model names or response bodies:
      // log the detail server-side and keep only a generic message in the database and API.
      this.logger.error(`Indexing source ${source.id} failed`, err as Error);
      // updateMany: the source may have been deleted while it was being indexed
      await this.prisma.knowledgeSource.updateMany({
        where: { id: source.id },
        data: { status: "failed", error: "Indexing failed. Check the AI provider settings and try again." },
      });
      throw new ServiceUnavailableException("Indexing failed. Check the AI provider settings and try again.");
    }
  }

  /** Semantic search limited to one workspace and to chunks made by the current embedding model. */
  async search(workspaceId: string, query: string): Promise<{ hits: KnowledgeHit[]; confidence: Confidence }> {
    const ai = await this.ai.forWorkspace(workspaceId);
    if (!ai.enabled) return { hits: [], confidence: "none" };
    const [qv] = await ai.embed([query]);
    const dims = qv.length;
    if (!Number.isInteger(dims) || dims < 1 || dims > 16000) throw new Error("Invalid embedding dimension");

    const rows = await this.prisma.$queryRaw<
      { chunkId: string; sourceId: string; sourceTitle: string; content: string; distance: number }[]
    >`
      SELECT c.id AS "chunkId", c."sourceId", s.title AS "sourceTitle", c.content,
             (c.embedding::vector(${Prisma.raw(String(dims))}) <=> ${toVector(qv)}::vector(${Prisma.raw(String(dims))})) AS distance
      FROM knowledge_chunks c
      JOIN knowledge_sources s ON s.id = c."sourceId"
      WHERE c."workspaceId" = ${workspaceId}
        AND c."embeddingModel" = ${ai.embeddingModel}
        AND c.dimensions = ${dims}
      ORDER BY distance ASC
      LIMIT ${TOP_K}`;

    const scored = rows.map((r) => ({ ...r, similarity: 1 - Number(r.distance) }));
    const high = scored.filter((r) => r.similarity >= HIGH_SIMILARITY);
    const low = scored.filter((r) => r.similarity >= LOW_SIMILARITY);
    const chosen = high.length ? high : low;
    const confidence: Confidence = high.length ? "high" : low.length ? "low" : "none";
    return {
      confidence,
      hits: chosen.map(({ distance: _d, ...r }) => r),
    };
  }

  /** Number of sources whose vectors were made by a different embedding model than the workspace uses now. */
  async staleSourceCount(workspaceId: string, embeddingModel: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT "sourceId") AS n FROM knowledge_chunks
      WHERE "workspaceId" = ${workspaceId} AND "embeddingModel" <> ${embeddingModel}`;
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Embeds every source again with the workspace's current embedding model. Needed after the model changes,
   * because search only compares vectors made by the same model. Sources without stored text cannot be redone.
   */
  async reindexAll(workspaceId: string, userId?: string): Promise<{ reindexed: number; failed: number; skipped: number }> {
    await assertOwnerOrAdmin(this.prisma, workspaceId, userId, "re-index the knowledge base");
    const ai = await this.ai.forWorkspace(workspaceId);
    if (!ai.enabled) throw new ServiceUnavailableException("AI provider is not configured");
    const sources = await this.prisma.knowledgeSource.findMany({ where: { workspaceId }, select: { id: true, text: true } });
    let reindexed = 0, failed = 0, skipped = 0;
    for (const s of sources) {
      if (!s.text) { skipped++; continue; }
      try {
        await this.index(workspaceId, s.id, s.text);
        reindexed++;
      } catch {
        failed++;
      }
    }
    return { reindexed, failed, skipped };
  }
}

function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
