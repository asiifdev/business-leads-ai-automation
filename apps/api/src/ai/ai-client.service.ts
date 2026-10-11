import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";
import { decryptSecret } from "../settings/encryption.util";
import * as dns from "dns";
import * as https from "https";
import * as net from "net";
import { hostIsPublic, isBlockedAddress } from "../marketing/url-fetch";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Where a workspace's AI calls go. `server` = the operator's `.env`; `workspace` = the key saved in Settings. */
export type AiSource = "workspace" | "server" | "none";

export interface AiSettings {
  source: AiSource;
  apiKey: string;
  baseURL?: string;
  chatModel: string;
  embeddingModel: string;
  reasoningEffort?: string;
}

export interface ServerAiDefaults {
  apiKey?: string;
  baseURL?: string;
  chatModel: string;
  embeddingModel: string;
  reasoningEffort?: string;
}

/** What a saved `openai` integration looks like once decrypted. Every field is optional on purpose. */
export interface StoredAiConfig {
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
}

export const DEFAULT_WORKSPACE_CHAT_MODEL = "gpt-4o-mini";
export const DEFAULT_WORKSPACE_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Decides which provider a workspace uses. Pure, so the rules are unit tested.
 *
 * - A workspace key wins over the server key, and brings its own base URL, models and nothing else from the server:
 *   a customer's key must never be sent to the operator's private endpoint, and a server model name such as a local
 *   Ollama tag would be meaningless to the customer's provider.
 * - With no workspace key the server `.env` applies. With neither, AI is off.
 */
export function pickAiSettings(stored: StoredAiConfig | null, integrationEnabled: boolean, server: ServerAiDefaults): AiSettings {
  const key = stored?.apiKey?.trim();
  if (integrationEnabled && key) {
    return {
      source: "workspace",
      apiKey: key,
      baseURL: stored?.baseURL?.trim() || undefined,
      chatModel: stored?.model?.trim() || DEFAULT_WORKSPACE_CHAT_MODEL,
      embeddingModel: stored?.embeddingModel?.trim() || DEFAULT_WORKSPACE_EMBEDDING_MODEL,
    };
  }
  if (server.apiKey) {
    return {
      source: "server",
      apiKey: server.apiKey,
      baseURL: server.baseURL || undefined,
      chatModel: server.chatModel,
      embeddingModel: server.embeddingModel,
      reasoningEffort: server.reasoningEffort,
    };
  }
  return { source: "none", apiKey: "", chatModel: server.chatModel, embeddingModel: server.embeddingModel };
}

/**
 * A workspace's base URL is typed by a user. On a shared (hosted) server it must point at a public address, otherwise
 * the server could be made to call its own network. A self-hosted install may use localhost (Ollama), which is
 * the whole point of running it yourself.
 */
export async function assertAllowedBaseUrl(raw: string, opts: { allowPrivate: boolean }): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("The base URL is not a valid address.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("The base URL must start with http:// or https://.");
  if (u.username || u.password) throw new Error("Do not put credentials in the base URL.");
  if (opts.allowPrivate) return;
  if (u.protocol !== "https:") throw new Error("On this server the base URL must use https://.");
  if (!(await hostIsPublic(u.hostname))) throw new Error("On this server the base URL must be a public address.");
}

/**
 * `dns.lookup` replacement for connections to a user-supplied host: it refuses private, loopback and link-local
 * addresses at connect time. Checking the name once and connecting later would let a name that changes its answer
 * (DNS rebinding) or a redirect reach the internal network; this runs for every connection, redirects included.
 */
export function publicOnlyLookup(hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (!list.length || bad) {
      const e: NodeJS.ErrnoException = new Error("The AI base URL resolves to a private address, which is not allowed on this server.");
      e.code = "EBLOCKED";
      return callback(e, "", 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/**
 * HTTPS agent for workspace-supplied endpoints. `publicOnlyLookup` covers names, but Node never calls `lookup` for an
 * IP literal (a redirect to https://10.0.0.5/ would skip it), so this also refuses blocked literals before connecting
 * and destroys any socket whose remote address turns out to be blocked, before a byte is sent.
 */
export class PublicOnlyAgent extends https.Agent {
  constructor() {
    super({ lookup: publicOnlyLookup as never, keepAlive: false });
  }

  createConnection(options: never, callback?: never): never {
    const o = options as { host?: string; hostname?: string };
    const host = (o.host ?? o.hostname ?? "").replace(/^\[|\]$/g, "");
    const blocked = () => Object.assign(new Error("The AI base URL points at a private address, which is not allowed on this server."), { code: "EBLOCKED" });
    if (host && net.isIP(host) && isBlockedAddress(host)) throw blocked();
    const socket = (super.createConnection as (o: unknown, c?: unknown) => net.Socket)(options, callback);
    socket.on("connect", () => {
      if (socket.remoteAddress && isBlockedAddress(socket.remoteAddress)) socket.destroy(blocked());
    });
    return socket as never;
  }
}

/** A chat and embeddings client bound to one workspace's settings. Retries transient failures (429 and 5xx). */
export class WorkspaceAi {
  private readonly logger = new Logger("WorkspaceAi");
  private readonly client: OpenAI | null;

  /**
   * `publicOnly` is set for workspace-supplied endpoints on a shared server: connections go through
   * `publicOnlyLookup`. The server's own endpoint is the operator's choice and is left alone.
   */
  constructor(readonly settings: AiSettings, opts: { publicOnly?: boolean } = {}) {
    this.client = settings.apiKey
      ? new OpenAI({
          apiKey: settings.apiKey,
          baseURL: settings.baseURL,
          ...(opts.publicOnly && settings.baseURL ? { httpAgent: new PublicOnlyAgent() } : {}),
        })
      : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }
  get source(): AiSource {
    return this.settings.source;
  }
  get chatModel(): string {
    return this.settings.chatModel;
  }
  get embeddingModel(): string {
    return this.settings.embeddingModel;
  }

  async chat(messages: ChatMessage[], opts: { temperature?: number; json?: boolean } = {}): Promise<string> {
    const client = this.requireClient();
    const res = await this.withRetry(() =>
      client.chat.completions.create({
        model: this.settings.chatModel,
        messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
        ...(this.settings.reasoningEffort ? ({ reasoning_effort: this.settings.reasoningEffort } as object) : {}),
      }),
    );
    return res.choices[0]?.message?.content ?? "";
  }

  /** Embeds texts in batches; returns one vector per input, in order. */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const client = this.requireClient();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64);
      const res = await this.withRetry(() => client.embeddings.create({ model: this.settings.embeddingModel, input: batch }));
      if (res.data.length !== batch.length) throw new Error(`Embedding provider returned ${res.data.length} vectors for ${batch.length} inputs`);
      out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return out;
  }

  private requireClient(): OpenAI {
    if (!this.client) throw new Error("AI provider is not configured. Add a key in Settings, or set OPENAI_API_KEY on the server (any value works for Ollama).");
    return this.client;
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        last = err;
        const status = (err as { status?: number }).status;
        if (status !== 429 && !(status && status >= 500)) throw err;
        const wait = 1000 * 2 ** i;
        this.logger.warn(`AI provider returned ${status}, retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw last;
  }
}

const CACHE_MS = 30_000;

/**
 * Hands out the AI client for a workspace. Every AI feature calls `forWorkspace(workspaceId)` instead of holding
 * one global client, so each business can use its own key, model and endpoint, and fall back to the server's.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly cache = new Map<string, { at: number; ai: WorkspaceAi }>();
  private readonly server: ServerAiDefaults;
  private readonly allowPrivateBaseUrl: boolean;

  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {
    this.server = {
      apiKey: config.get<string>("OPENAI_API_KEY") || undefined,
      baseURL: config.get<string>("OPENAI_BASE_URL") || undefined,
      chatModel: config.get<string>("OPENAI_MODEL") || "gpt-4o-mini",
      embeddingModel: config.get<string>("EMBEDDING_MODEL") || "text-embedding-3-small",
      reasoningEffort: config.get<string>("OPENAI_REASONING_EFFORT") || undefined,
    };
    this.allowPrivateBaseUrl = config.get<string>("EDITION") !== "hosted" || config.get<string>("AI_ALLOW_PRIVATE_BASE_URL") === "true";
  }

  /** True when this server has its own key, whatever any workspace does. */
  get serverEnabled(): boolean {
    return !!this.server.apiKey;
  }

  get allowPrivate(): boolean {
    return this.allowPrivateBaseUrl;
  }

  async forWorkspace(workspaceId: string): Promise<WorkspaceAi> {
    const hit = this.cache.get(workspaceId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.ai;
    const settings = await this.resolve(workspaceId);
    const ai = new WorkspaceAi(settings, { publicOnly: settings.source === "workspace" && !this.allowPrivateBaseUrl });
    this.cache.set(workspaceId, { at: Date.now(), ai });
    return ai;
  }

  /** Call after the workspace's AI settings change so the next request sees them. */
  invalidate(workspaceId: string): void {
    this.cache.delete(workspaceId);
  }

  private async resolve(workspaceId: string): Promise<AiSettings> {
    const row = await this.prisma.integration.findFirst({ where: { workspaceId, type: "openai" } });
    let stored: StoredAiConfig | null = null;
    if (row) {
      const raw = (row.config ?? {}) as Record<string, string>;
      try {
        stored = {
          apiKey: raw.apiKey ? decryptSecret(raw.apiKey, this.config.get<string>("ENCRYPTION_KEY")!) : undefined,
          model: raw.model,
          embeddingModel: raw.embeddingModel,
          baseURL: raw.baseURL,
        };
      } catch (e) {
        // A key that cannot be decrypted (ENCRYPTION_KEY changed) is treated as absent, loudly.
        this.logger.warn(`Workspace ${workspaceId}: saved AI key could not be decrypted (${(e as Error).message}); using the server key if any`);
      }
    }
    const picked = pickAiSettings(stored, row?.enabled ?? false, this.server);
    if (picked.source === "workspace" && picked.baseURL) {
      try {
        await assertAllowedBaseUrl(picked.baseURL, { allowPrivate: this.allowPrivateBaseUrl });
      } catch (e) {
        this.logger.warn(`Workspace ${workspaceId}: ${(e as Error).message} The workspace key is ignored.`);
        return pickAiSettings(null, false, this.server);
      }
    }
    return picked;
  }
}
