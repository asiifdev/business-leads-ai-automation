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
