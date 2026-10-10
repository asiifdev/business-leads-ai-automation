import { clip } from "../ai/chat-import/style-prompt";

/**
 * The Marketing Brief follows the structure of the `product-marketing` skill (overview, audience, problems,
 * differentiation, objections, proof, voice) plus the offer and a few outreach angles. Facts must come from the
 * user's sources: whatever is missing is listed in `gaps` as "[NEED: ...]" instead of being invented.
 */
export interface BriefContent {
  overview: { oneLiner: string; whatItDoes: string; category: string; businessModel: string };
  audience: { targetCustomers: string; decisionMakers: string; primaryUseCase: string; jobsToBeDone: string[] };
  problems: { coreProblem: string; whyAlternativesFallShort: string[]; cost: string };
  differentiation: { keyDifferentiators: string[]; whyBetter: string };
  objections: { objection: string; response: string }[];
  proof: { metrics: string[]; customers: string[]; testimonials: string[] };
  offer: { pricing: string; callToAction: string };
  voice: { tone: string; wordsToUse: string[]; wordsToAvoid: string[] };
  /** Hypotheses to test per segment, not facts. */
  angles: { segment: string; pain: string; hook: string; benefit: string }[];
  gaps: string[];
}

/** Pre-filled campaign settings, for the user to correct. `target` describes the businesses to look for, not the user's own company. */
export interface CampaignSuggestion {
  name: string;
  target: string;
  location: string;
  searchQueries: string[];
  contentStyle: "professional" | "friendly" | "balanced" | "casual";
  language: "indonesian" | "english";
}

export interface ParsedBrief {
  summary: string;
  content: BriefContent;
  campaign: CampaignSuggestion;
}

const SUMMARY_MAX = 450;
const str = (v: unknown, max = 600): string => (typeof v === "string" ? clip(v, max) : typeof v === "number" ? String(v) : "");
const list = (v: unknown, n: number, max = 300): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((x) => str(x, max)).filter(Boolean).slice(0, n);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function emptyBrief(): BriefContent {
  return {
    overview: { oneLiner: "", whatItDoes: "", category: "", businessModel: "" },
    audience: { targetCustomers: "", decisionMakers: "", primaryUseCase: "", jobsToBeDone: [] },
    problems: { coreProblem: "", whyAlternativesFallShort: [], cost: "" },
    differentiation: { keyDifferentiators: [], whyBetter: "" },
    objections: [],
    proof: { metrics: [], customers: [], testimonials: [] },
    offer: { pricing: "", callToAction: "" },
    voice: { tone: "", wordsToUse: [], wordsToAvoid: [] },
    angles: [],
    gaps: [],
  };
}

/** Pulls the JSON object out of a model reply that may be wrapped in code fences or prose. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the reply");
  return JSON.parse(t.slice(start, end + 1));
}

/** Finds a key anywhere in a (small) object tree: models sometimes nest a section inside another one. */
function deepFind(v: unknown, key: string, depth = 0): unknown {
  if (!v || typeof v !== "object" || depth > 4) return undefined;
  const o = v as Record<string, unknown>;
  if (key in o) return o[key];
  for (const child of Object.values(o)) {
    const found = deepFind(child, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Merges the JSON of several passes: later keys win for sections, `gaps` are concatenated. */
export function mergeRaw(parts: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const gaps: unknown[] = [];
  for (const p of parts) {
    const o = obj(p);
    for (const [k, v] of Object.entries(o)) {
      if (k === "gaps") gaps.push(...(Array.isArray(v) ? v : typeof v === "string" ? [v] : []));
      else out[k] = v;
    }
  }
  out.gaps = gaps;
  return out;
}

/** Coerces anything the model returned into the brief shape, with length caps. Never throws on missing fields. */
export function coerceBrief(raw: unknown, language: "indonesian" | "english" = "indonesian"): ParsedBrief {
  const r = obj(raw);
  const sec = (k: string) => obj(r[k] ?? deepFind(r, k));
  const o = sec("overview"), a = sec("audience"), p = sec("problems"), d = sec("differentiation"), pr = sec("proof"), of = sec("offer"), v = sec("voice");
  const content: BriefContent = {
    overview: { oneLiner: str(o.oneLiner, 240), whatItDoes: str(o.whatItDoes, 500), category: str(o.category, 120), businessModel: str(o.businessModel, 300) },
    audience: { targetCustomers: str(a.targetCustomers, 400), decisionMakers: str(a.decisionMakers, 300), primaryUseCase: str(a.primaryUseCase, 400), jobsToBeDone: list(a.jobsToBeDone, 4) },
    problems: { coreProblem: str(p.coreProblem, 500), whyAlternativesFallShort: list(p.whyAlternativesFallShort, 4), cost: str(p.cost, 400) },
    differentiation: { keyDifferentiators: list(d.keyDifferentiators, 5), whyBetter: str(d.whyBetter, 500) },
    objections: (Array.isArray(r.objections ?? deepFind(r, "objections")) ? ((r.objections ?? deepFind(r, "objections")) as unknown[]) : []).map((x) => ({ objection: str(obj(x).objection, 200), response: str(obj(x).response, 400) })).filter((x) => x.objection && x.response).slice(0, 6),
    proof: { metrics: list(pr.metrics, 6), customers: list(pr.customers, 8, 120), testimonials: list(pr.testimonials, 4, 400) },
    offer: { pricing: str(of.pricing, 400), callToAction: str(of.callToAction, 200) },
    voice: { tone: str(v.tone, 300), wordsToUse: list(v.wordsToUse, 10, 60), wordsToAvoid: list(v.wordsToAvoid, 10, 60) },
    angles: (Array.isArray(r.angles ?? deepFind(r, "angles")) ? ((r.angles ?? deepFind(r, "angles")) as unknown[]) : [])
      .map((x) => ({ segment: str(obj(x).segment, 120), pain: str(obj(x).pain, 300), hook: str(obj(x).hook, 300), benefit: str(obj(x).benefit, 300) }))
      .filter((x) => x.segment && x.hook)
      .slice(0, 6),
    gaps: list(r.gaps, 12, 240).map((g) => (/^\[NEED:/i.test(g) ? g : `[NEED: ${g.replace(/^\[|\]$/g, "")}]`)),
  };
  const c = sec("campaign");
  const style = typeof c.contentStyle === "string" ? c.contentStyle.toLowerCase() : "";
  const campaign: CampaignSuggestion = {
    name: str(c.name, 80),
    target: str(c.target, 80),
    location: str(c.location, 80),
    searchQueries: [...new Set(list(c.searchQueries, 6, 60).map((q) => q.replace(/\s+/g, " ")))],
    contentStyle: (["professional", "friendly", "balanced", "casual"] as const).find((x) => x === style) ?? "balanced",
    language: c.language === "english" ? "english" : c.language === "indonesian" ? "indonesian" : language,
  };
  // the form needs a place to search; when the sources do not say, the user has to fill it in
  if (!campaign.location && !content.gaps.some((g) => /lokasi|location/i.test(g))) content.gaps.push("[NEED: lokasi target (kota atau wilayah) belum jelas, isi sendiri di form kampanye]");
  let summary = str(r.summary, SUMMARY_MAX);
  if (!summary) summary = clip([content.overview.oneLiner, content.overview.whatItDoes].filter(Boolean).join(" "), SUMMARY_MAX);
  if (!summary) throw new Error("the model did not return a usable brief");
  return { summary, content, campaign };
}

const digits = (s: string) => s.replace(/[.,\s]/g, "");
const numbersIn = (s: string) => (s.match(/\d[\d.,]*/g) ?? []).map(digits).filter((n) => n.length >= 1);

/**
 * Anything presented as evidence must be traceable to the sources: numbers must occur in them, and customer names
 * and testimonials must (mostly) occur too. Items that are not are removed and reported as gaps, so a model that
 * invents "trusted by 500 businesses" cannot put it into a brief.
 */
export function groundBrief(brief: ParsedBrief, sourceText: string): ParsedBrief {
  const corpus = sourceText.toLowerCase();
  const corpusDigits = digits(sourceText);
  const numbersOk = (item: string) => numbersIn(item).every((n) => corpusDigits.includes(n));
  const wordsOk = (item: string) => {
    if (corpus.includes(item.toLowerCase())) return true;
    const words = item.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    return words.length > 0 && words.filter((w) => corpus.includes(w)).length / words.length >= 0.6;
  };
  const dropped: string[] = [];
  const keep = (items: string[], label: string, ok: (s: string) => boolean) =>
    items.filter((i) => {
      if (ok(i)) return true;
      dropped.push(`[NEED: ${label} "${i.slice(0, 80)}" tidak ditemukan di sumber, tambahkan buktinya atau hapus]`);
      return false;
    });
  const c = brief.content;
  const proof = {
    metrics: keep(c.proof.metrics, "angka", (i) => numbersIn(i).length > 0 && numbersOk(i)),
    customers: keep(c.proof.customers, "pelanggan", wordsOk),
    testimonials: keep(c.proof.testimonials, "testimoni", wordsOk),
  };
  let pricing = c.offer.pricing;
  if (pricing && !(numbersIn(pricing).length === 0 || numbersOk(pricing))) {
    dropped.push("[NEED: harga tidak ditemukan di sumber, isi harga yang benar]");
    pricing = "";
  }
  // numbers in the summary follow the same rule
  const summaryNumbersOk = numbersOk(brief.summary);
  const summary = summaryNumbersOk
    ? brief.summary
    : clip(brief.summary.replace(/\b\d[\d.,]*\s?(%|persen|x|kali|tahun|bulan|klien|pelanggan)?(?=\s|$|[.,])/gi, "").replace(/\s{2,}/g, " "), SUMMARY_MAX);
  if (!summaryNumbersOk) dropped.push("[NEED: ringkasan memuat angka yang tidak ada di sumber, angka itu dihapus]");
  return {
    summary,
    campaign: brief.campaign,
    content: { ...c, proof, offer: { ...c.offer, pricing }, gaps: [...new Set([...c.gaps, ...dropped])].slice(0, 16) },
  };
}
