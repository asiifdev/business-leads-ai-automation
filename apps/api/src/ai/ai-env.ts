import { missingAiFields } from "./ai-client.service";

const ENV_NAME = { baseURL: "OPENAI_BASE_URL", chatModel: "OPENAI_MODEL", embeddingModel: "EMBEDDING_MODEL" } as const;

/**
 * Boot-time check of the server's AI settings. Prospex has no built-in provider, base URL or model name: when
 * `OPENAI_API_KEY` is set, the endpoint and both models must be written in the environment, otherwise the API refuses
 * to start. With no key, AI is simply off and nothing is required. Returns a list of problems (empty when fine).
 */
export function aiEnvProblems(env: Record<string, string | undefined>): string[] {
  if (!env.OPENAI_API_KEY?.trim()) return [];
  const missing = missingAiFields({ baseURL: env.OPENAI_BASE_URL, chatModel: env.OPENAI_MODEL, embeddingModel: env.EMBEDDING_MODEL });
  return missing.map((k) => `${ENV_NAME[k]} is empty but OPENAI_API_KEY is set`);
}

/** The message printed before the API aborts. */
export function aiEnvMessage(problems: string[]): string {
  return `AI is configured incompletely. Prospex has no built-in base URL or model names, so write them down in apps/api/.env:\n  - ${problems.join("\n  - ")}\nSet them (for example the provider's /v1 address and your model names), or empty OPENAI_API_KEY to run with AI off.`;
}
