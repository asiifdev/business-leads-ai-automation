/**
 * Reads the first JSON object out of a model's answer. Models wrap JSON in prose or code fences, or add a second object after it;
 * `JSON.parse` on the whole text fails on all of those. The scan is linear and respects strings, so braces inside text do not confuse it.
 * Returns null when there is no complete object (for example an answer cut off by the token limit).
 */
export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}
