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

const GENERIC_WORDS = new Set(["rental", "sewa", "penyewaan", "persewaan", "usaha", "bisnis", "alat", "peralatan", "layanan", "toko", "jasa", "agen", "service", "shop", "store", "perlengkapan", "barang"]);

/**
 * Words that belong to ANOTHER kind of business in the brief (say "kebaya" for a costume shop) but appear in a draft.
 * A word counts as another business's when it is in exactly one brief segment and not in this lead's own name or category.
 */
export function foreignVerticalWords(draft: string, lead: { name: string; category?: string | null }, angles: BriefContent["angles"]): string[] {
  const own = new Set(tokens(`${lead.name} ${lead.category ?? ""}`));
  const mine = pickAngle(angles ?? [], lead.name, lead.category);
  const count = new Map<string, number>();
  for (const a of angles ?? []) for (const w of new Set(tokens(a.segment))) count.set(w, (count.get(w) ?? 0) + 1);
  const mineWords = new Set(mine ? tokens(mine.segment) : []);
  const wanted = new Set([...count].filter(([w, n]) => n === 1 && !GENERIC_WORDS.has(w) && !mineWords.has(w) && !own.has(w) && ![...own].some((o) => o.startsWith(w) || w.startsWith(o))).map(([w]) => w));
  const said = new Set(tokens(draft));
  return [...wanted].filter((w) => said.has(w));
}
