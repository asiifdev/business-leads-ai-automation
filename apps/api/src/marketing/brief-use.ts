import type { BriefContent } from "./brief-schema";

/** What the draft writer takes from the Marketing Brief, kept small so the prompt stays focused. */
export interface BriefForDraft {
  summary: string;
  angle?: { segment: string; pain: string; hook: string; benefit: string };
  /** Only items that passed the grounding check when the brief was made. */
  proof: string[];
  wordsToAvoid: string[];
}

const tokens = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 4);

/** The angle whose segment shares the most words with the business's name and real Maps category; none when nothing overlaps. */
export function pickAngle(angles: BriefContent["angles"], name: string, category?: string | null) {
  const target = new Set(tokens(`${name} ${category ?? ""}`));
  let best: { a: BriefContent["angles"][number]; score: number } | undefined;
  for (const a of angles) {
    const score = tokens(a.segment).filter((w) => target.has(w) || [...target].some((t) => t.startsWith(w) || w.startsWith(t))).length;
    if (score > 0 && (!best || score > best.score)) best = { a, score };
  }
  return best?.a;
}

export function briefForDraft(summary: string, content: BriefContent, lead: { name: string; category?: string | null }): BriefForDraft {
  return {
    summary,
    angle: pickAngle(content.angles ?? [], lead.name, lead.category),
    proof: [...(content.proof?.customers ?? []).slice(0, 3), ...(content.proof?.metrics ?? []).slice(0, 2)],
    wordsToAvoid: content.voice?.wordsToAvoid ?? [],
  };
}
