export interface ChunkOptions {
  /** Target maximum characters per chunk. */
  maxChars?: number;
  /** Characters repeated at the start of the next chunk so ideas are not cut in half. */
  overlap?: number;
}

/**
 * Splits text into chunks on paragraph, then sentence, boundaries. Pure and
 * deterministic so it can be tested without a database or an AI provider.
 */
export function chunkText(input: string, { maxChars = 900, overlap = 120 }: ChunkOptions = {}): string[] {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const pieces: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length <= maxChars) {
      pieces.push(p);
      continue;
    }
    // Paragraph too long: fall back to sentences, then hard-split.
    let current = "";
    for (const sentence of p.split(/(?<=[.!?。！？])\s+/)) {
      if (sentence.length > maxChars) {
        if (current) pieces.push(current);
        current = "";
        for (let i = 0; i < sentence.length; i += maxChars) pieces.push(sentence.slice(i, i + maxChars));
      } else if ((current + " " + sentence).trim().length > maxChars) {
        pieces.push(current);
        current = sentence;
      } else {
        current = (current + " " + sentence).trim();
      }
    }
    if (current) pieces.push(current);
  }

  // Merge small neighbours up to maxChars, then add overlap between chunks.
  const merged: string[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last && last.length + piece.length + 2 <= maxChars) merged[merged.length - 1] = `${last}\n\n${piece}`;
    else merged.push(piece);
  }
  if (overlap <= 0) return merged;
  return merged.map((chunk, i) => {
    if (i === 0) return chunk;
    const tail = merged[i - 1].slice(-overlap);
    return `${tail} ${chunk}`.trim();
  });
}

const kw = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 4);

/** Keyword ranking for sources that have text but no vectors (embeddings unavailable or indexing failed): better than finding nothing. */
export function rankByKeywords(query: string, passages: { id: string; label: string; text: string }[], limit = 4): { id: string; label: string; text: string }[] {
  const q = new Set(kw(query));
  if (!q.size) return [];
  return passages
    .map((p) => { const w = kw(p.text); const hit = new Set(w.filter((x) => q.has(x) || [...q].some((y) => y.length >= 5 && x.length >= 5 && x.startsWith(y.slice(0, 5))))); return { p, score: hit.size }; })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}
