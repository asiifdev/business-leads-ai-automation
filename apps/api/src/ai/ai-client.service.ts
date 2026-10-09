import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Thin wrapper over any OpenAI-compatible endpoint (OpenAI, OpenRouter, Ollama).
 * Retries transient failures (429 and 5xx) with backoff. When no API key is
 * configured it reports `enabled === false` so callers can fall back to mock
 * behaviour instead of failing.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly client: OpenAI | null = null;
  readonly chatModel: string;
  readonly embeddingModel: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("OPENAI_API_KEY");
    this.chatModel = config.get<string>("OPENAI_MODEL") || "gpt-4o-mini";
    this.embeddingModel = config.get<string>("EMBEDDING_MODEL") || "text-embedding-3-small";
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL: config.get<string>("OPENAI_BASE_URL") || undefined });
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async chat(messages: ChatMessage[], opts: { temperature?: number; json?: boolean } = {}): Promise<string> {
    const client = this.requireClient();
    const res = await this.withRetry(() =>
      client.chat.completions.create({
        model: this.chatModel,
        messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
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
      const res = await this.withRetry(() => client.embeddings.create({ model: this.embeddingModel, input: batch }));
      if (res.data.length !== batch.length) throw new Error(`Embedding provider returned ${res.data.length} vectors for ${batch.length} inputs`);
      out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return out;
  }

  private requireClient(): OpenAI {
    if (!this.client) throw new Error("AI provider is not configured (set OPENAI_API_KEY; use any value for Ollama)");
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
