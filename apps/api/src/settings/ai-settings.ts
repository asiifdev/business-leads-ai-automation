/** Turns a provider failure into a short sentence for the Settings screen. Never echoes the provider's message: it can contain part of the key. */
export function friendlyAiError(e: unknown): string {
  const x = e as { status?: number; code?: string; name?: string; cause?: { code?: string } };
  const code = x?.code ?? x?.cause?.code;
  if (x?.status === 401 || x?.status === 403) return "The provider rejected the key. Check that it is correct and has access to this model.";
  if (x?.status === 404) return "The provider does not know this model or endpoint. Check the model name and the base URL.";
  if (x?.status === 429) return "The provider is rate limiting this key or the account has no credit left.";
  if (x?.status && x.status >= 500) return "The provider returned an error. Try again in a moment.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "The base URL could not be found. Check the address.";
  if (code === "ECONNREFUSED") return "The base URL refused the connection. Is the service running?";
  if (code === "ETIMEDOUT" || x?.name === "APIConnectionTimeoutError") return "The provider did not answer in time.";
  if (x?.name === "APIConnectionError") return "Could not connect to the provider. Check the base URL.";
  return "The test call failed. Check the key, the model and the base URL.";
}

export interface SaveAiInput {
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
}

/** Merges an update into the saved config. A blank key keeps the saved one, so the screen never has to know the key. */
export function mergeAiConfig(existing: Record<string, string> | null, input: SaveAiInput): Record<string, string> {
  const out: Record<string, string> = { ...(existing ?? {}) };
  if (typeof input.apiKey === "string" && input.apiKey.trim()) out.apiKey = input.apiKey.trim();
  for (const k of ["model", "embeddingModel", "baseURL"] as const) {
    const v = input[k];
    if (typeof v === "string") {
      if (v.trim()) out[k] = v.trim();
      else delete out[k];
    }
  }
  return out;
}
