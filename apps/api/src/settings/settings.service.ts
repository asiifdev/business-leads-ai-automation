import { randomBytes, createHash } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { encryptSecret, decryptSecret } from "./encryption.util";
import { AiClientService, assertAllowedBaseUrl } from "../ai/ai-client.service";
import { KnowledgeService } from "../ai/knowledge.service";
import { friendlyAiError, mergeAiConfig, type SaveAiInput } from "./ai-settings";
import { assertOwnerOrAdmin } from "../auth/roles";

const DEFAULT_WORKSPACE_ID = "default-workspace";
const SECRET_CONFIG_KEYS = ["apiKey"];

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private aiClient: AiClientService,
    private knowledge: KnowledgeService,
  ) {}

  private get encryptionKey(): string {
    return this.config.get<string>("ENCRYPTION_KEY")!;
  }

  private decryptConfig(config: Record<string, string>): Record<string, string> {
    const result = { ...config };
    for (const key of SECRET_CONFIG_KEYS) {
      if (result[key]) result[key] = decryptSecret(result[key], this.encryptionKey);
    }
    return result;
  }

  private encryptConfig(config: Record<string, string>): Record<string, string> {
    const result = { ...config };
    for (const key of SECRET_CONFIG_KEYS) {
      if (result[key]) result[key] = encryptSecret(result[key], this.encryptionKey);
    }
    return result;
  }

  async getIntegrations(workspaceId = DEFAULT_WORKSPACE_ID) {
    const integrations = await this.prisma.integration.findMany({ where: { workspaceId } });
    // Secrets are never sent back to the browser: the screen only learns that one is saved.
    return integrations.map((integration) => {
      const raw = (integration.config ?? {}) as Record<string, string>;
      const config = { ...raw };
      const secretSet: Record<string, boolean> = {};
      for (const key of SECRET_CONFIG_KEYS) {
        secretSet[key] = !!config[key];
        if (key in config) config[key] = "";
      }
      return { ...integration, config, secretSet };
    });
  }

  async upsertIntegration(
    type: string,
    name: string,
    config: Record<string, string>,
    workspaceId = DEFAULT_WORKSPACE_ID,
    userId?: string,
  ) {
    await this.requireOwnerOrAdmin(workspaceId, userId);
    if (type === "openai") return this.saveAi(workspaceId, config, userId);
    const encryptedConfig = this.encryptConfig(config);
    const existing = await this.prisma.integration.findFirst({ where: { workspaceId, type } });
    if (existing) {
      return this.prisma.integration.update({
        where: { id: existing.id },
        data: { config: encryptedConfig, enabled: true },
      });
    }
    return this.prisma.integration.create({ data: { type, name, config: encryptedConfig, workspaceId } });
  }

  async listApiKeys(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
  }

  async createApiKey(name: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const plaintext = `px_${randomBytes(32).toString("base64url")}`;
    const keyHash = createHash("sha256").update(plaintext).digest("hex");
    const keyPrefix = plaintext.slice(0, 10); // "px_" + first 7 chars

    await this.prisma.apiKey.create({
      data: { name, keyHash, keyPrefix, workspaceId },
    });

    // Return the plaintext key exactly once — it is never stored and cannot be recovered
    return { name, keyPrefix, key: plaintext, note: "Store this key securely — it will not be shown again." };
  }

  async deleteApiKey(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException("API key not found");
    return this.prisma.apiKey.delete({ where: { id } });
  }

  // ---- AI provider (per workspace) ----

  private requireOwnerOrAdmin(workspaceId: string, userId: string | undefined) {
    return assertOwnerOrAdmin(this.prisma, workspaceId, userId, "change the AI provider or integrations");
  }

  async aiStatus(workspaceId: string) {
    const [row, ai] = await Promise.all([
      this.prisma.integration.findFirst({ where: { workspaceId, type: "openai" } }),
      this.aiClient.forWorkspace(workspaceId),
    ]);
    const raw = (row?.config ?? {}) as Record<string, string>;
    const [staleSources, style] = await Promise.all([
      ai.enabled ? this.knowledge.staleSourceCount(workspaceId, ai.embeddingModel) : Promise.resolve(0),
      this.prisma.styleProfile.findUnique({ where: { workspaceId }, select: { embeddingModel: true } }),
    ]);
    return {
      source: ai.source, // "workspace" | "server" | "none"
      enabled: ai.enabled,
      chatModel: ai.chatModel,
      embeddingModel: ai.embeddingModel,
      workspace: {
        hasKey: !!raw.apiKey,
        model: raw.model ?? "",
        embeddingModel: raw.embeddingModel ?? "",
        baseURL: raw.baseURL ?? "",
      },
      serverKeyAvailable: this.aiClient.serverEnabled,
      allowPrivateBaseUrl: this.aiClient.allowPrivate,
      staleKnowledgeSources: staleSources,
      styleNeedsRetraining: !!style && style.embeddingModel !== ai.embeddingModel,
    };
  }

  async saveAi(workspaceId: string, input: SaveAiInput, userId?: string) {
    await this.requireOwnerOrAdmin(workspaceId, userId);
    if (input.baseURL?.trim()) {
      try {
        await assertAllowedBaseUrl(input.baseURL.trim(), { allowPrivate: this.aiClient.allowPrivate });
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }
    for (const k of ["apiKey", "model", "embeddingModel", "baseURL"] as const) {
      if (input[k] !== undefined && (typeof input[k] !== "string" || input[k]!.length > 500)) throw new BadRequestException(`${k} is not valid`);
    }
    const existing = await this.prisma.integration.findFirst({ where: { workspaceId, type: "openai" } });
    const current = (existing?.config ?? null) as Record<string, string> | null;
    const merged = mergeAiConfig(
      current ? { ...current, ...(current.apiKey ? { apiKey: decryptSecret(current.apiKey, this.encryptionKey) } : {}) } : null,
      input,
    );
    const config = this.encryptConfig(merged);
    if (existing) await this.prisma.integration.update({ where: { id: existing.id }, data: { config, enabled: true } });
    else await this.prisma.integration.create({ data: { type: "openai", name: "OpenAI / Compatible API", config, workspaceId } });
    this.aiClient.invalidate(workspaceId);
    return this.aiStatus(workspaceId);
  }

  /** Forget the workspace's own provider and go back to the server's. */
  async clearAi(workspaceId: string, userId?: string) {
    await this.requireOwnerOrAdmin(workspaceId, userId);
    await this.prisma.integration.deleteMany({ where: { workspaceId, type: "openai" } });
    this.aiClient.invalidate(workspaceId);
    return this.aiStatus(workspaceId);
  }

  /** One tiny chat call and one embedding call with the settings this workspace really uses. */
  async testAi(workspaceId: string, userId?: string) {
    await this.requireOwnerOrAdmin(workspaceId, userId);
    const ai = await this.aiClient.forWorkspace(workspaceId);
    if (!ai.enabled) return { ok: false, source: ai.source, error: "No AI provider is configured for this workspace." };
    const started = Date.now();
    try {
      await ai.chat([{ role: "user", content: "Reply with the single word: ok" }], { temperature: 0 });
    } catch (e) {
      return { ok: false, source: ai.source, step: "chat", chatModel: ai.chatModel, error: friendlyAiError(e) };
    }
    try {
      const [v] = await ai.embed(["tes"]);
      return { ok: true, source: ai.source, chatModel: ai.chatModel, embeddingModel: ai.embeddingModel, dimensions: v.length, latencyMs: Date.now() - started };
    } catch (e) {
      return { ok: false, source: ai.source, step: "embedding", embeddingModel: ai.embeddingModel, error: friendlyAiError(e) };
    }
  }
}
