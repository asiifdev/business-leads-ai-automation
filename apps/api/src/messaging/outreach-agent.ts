import type { ToolCall, ToolChatMessage, ToolDef } from "../ai/ai-client.service";

/**
 * The first-message writer as an agent. The model is not handed a pile of context: it asks for what it needs (the owner's brief,
 * the knowledge base, facts about the recipient), writes, and then must name the source of every factual claim. Code checks each
 * claim against what was actually retrieved, plus the deterministic rules (numbers, prices, links, other businesses' words, stubs),
 * and an auditor model reads the message against the sources. A message that fails goes back to the writer with the reasons.
 *
 * Nothing here knows any kind of business: what a niche needs comes from the owner's own brief and knowledge at run time.
 */

export const BRIEF_SECTIONS = ["overview", "audience", "problems", "differentiation", "objections", "proof", "offer", "voice", "angles", "gaps"] as const;
export type BriefSection = (typeof BRIEF_SECTIONS)[number];

export interface AgentSource {
  /** `k:<chunkId>`, `brief:<section>`, `recipient` or `link`. */
  id: string;
  label: string;
  text: string;
}

export interface Claim {
  text: string;
  source: string;
}

export interface AgentBackend {
  searchKnowledge(query: string): Promise<AgentSource[]>;
  briefSection(section: BriefSection | "all"): AgentSource | null;
  recipient(): AgentSource;
  /** Deterministic rules on the finished message; `sources` are the texts retrieved so far. Returns plain-language problems. */
  checks(message: string, sources: string[]): string[];
  /** A second model reads the message against the sources and lists statements the sources do not support. */
  audit?(message: string, sources: AgentSource[]): Promise<string[]>;
}

export interface AgentRun {
  chat: (messages: ToolChatMessage[], tools: ToolDef[]) => Promise<{ content: string; toolCalls: ToolCall[] }>;
  system: string;
  backend: AgentBackend;
  maxSteps?: number;
  /** The owner's link: a source in its own right, and the only URL the message may contain. */
  link?: string;
}

export interface AgentResult {
  message: string;
  claims: Claim[];
  steps: number;
  /** One short line per step, for the run log. */
  trace: string[];
  sourceIds: string[];
  /** Every text the agent read, so later risk checks compare the message with what it actually had. */
  sourceTexts: string[];
}

const TOOLS: ToolDef[] = [
  {
    name: "get_brief",
    description: "Read the owner's marketing brief. Sections: overview (what the business is and does), audience (who it sells to), problems, differentiation, objections, proof (customers, numbers, testimonials, only what exists), offer (pricing and call to action), voice, angles, gaps (what is NOT known). Use 'all' for everything.",
    parameters: { type: "object", properties: { section: { type: "string", enum: [...BRIEF_SECTIONS, "all"] } }, required: ["section"] },
  },
  {
    name: "search_knowledge",
    description: "Search the owner's knowledge base (facts, catalog, FAQ, policies, documents). Call it several times with different questions: what the offer does for THIS kind of business, how it works, what is included, what it costs, what is not offered. Returns passages with ids.",
    parameters: { type: "object", properties: { query: { type: "string", description: "A specific question or topic" } }, required: ["query"] },
  },
  {
    name: "get_recipient",
    description: "Facts about the business receiving the message (its kind of business and whatever is known about it). The only source for claims about the recipient.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "check_message",
    description: "Test a draft without finishing: returns the problems that would stop it. Use it to iterate.",
    parameters: messageSchema(),
  },
  {
    name: "finish",
    description: "Submit the final message. It is accepted only if every factual claim has a source you retrieved and no check fails; otherwise you get the reasons and must fix it.",
    parameters: messageSchema(),
  },
];

function messageSchema() {
  return {
    type: "object",
    properties: {
      message: { type: "string", description: "The complete message, exactly as it should be sent (no labels, no quotes)" },
      claims: {
        type: "array",
        description: "Every factual statement in the message about the sender, the offer, or the recipient, each with the source id it comes from (e.g. brief:offer, k:<id>, recipient, link). Questions, greetings and invitations are not claims.",
        items: { type: "object", properties: { text: { type: "string" }, source: { type: "string" } }, required: ["text", "source"] },
      },
    },
    required: ["message", "claims"],
  };
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 4);

/** Share of a claim's content words that the source also contains (prefix match, so "pesanan"/"memesan" count). Pure and cheap: a first filter before the auditor. */
export function support(claim: string, source: string): number {
  const cw = [...new Set(words(claim))];
  if (!cw.length) return 1;
  const sw = words(source);
  const hit = cw.filter((w) => sw.some((x) => x === w || (w.length >= 5 && x.length >= 5 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5))))));
  return hit.length / cw.length;
}

const NUMBER = /\d[\d.,]*/g;
const digits = (s: string) => s.replace(/\D/g, "");

/** Every number in the message must appear in a retrieved source: prices, counts, years and percentages are never the model's to supply. */
export function unsupportedNumbers(message: string, sources: string[]): string[] {
  const known = new Set(sources.flatMap((t) => (t.match(NUMBER) ?? []).map(digits)).filter(Boolean));
  return [...new Set((message.match(NUMBER) ?? []).filter((n) => digits(n) && !known.has(digits(n))))];
}

function parse(args: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(args || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function runOutreachAgent(run: AgentRun): Promise<AgentResult | null> {
  const maxSteps = run.maxSteps ?? 14;
  const retrieved = new Map<string, AgentSource>();
  if (run.link) retrieved.set("link", { id: "link", label: "owner link", text: run.link });
  const messages: ToolChatMessage[] = [{ role: "system", content: run.system }, { role: "user", content: "Mulai. Pelajari dulu sumbernya dengan tool, lalu tulis pesannya." }];
  const trace: string[] = [];

  const validate = async (message: string, claims: Claim[]): Promise<string[]> => {
    const problems: string[] = [];
    if (!message.trim()) return ["pesan kosong"];
    if (!claims.length) problems.push("belum ada klaim bersumber: tulis setiap pernyataan faktual tentang kita, penawaran, atau penerima beserta id sumbernya");
    for (const c of claims) {
      const src = retrieved.get(c.source);
      if (!src) { problems.push(`klaim "${clip(c.text, 70)}" memakai sumber "${c.source}" yang belum kamu ambil dengan tool`); continue; }
      if (support(c.text, src.text) < 0.5) problems.push(`klaim "${clip(c.text, 70)}" tidak ditemukan di sumber ${c.source}`);
    }
    const texts = [...retrieved.values()].map((s) => s.text);
    const nums = unsupportedNumbers(message, texts);
    if (nums.length) problems.push(`angka yang tidak ada di sumber mana pun: ${nums.join(", ")}`);
    problems.push(...run.backend.checks(message, texts));
    if (!problems.length && run.backend.audit) {
      try { problems.push(...(await run.backend.audit(message, [...retrieved.values()]))); } catch { /* an unavailable auditor must not block a message the code checks passed */ }
    }
    return problems;
  };

  for (let step = 1; step <= maxSteps; step++) {
    const res = await run.chat(messages, TOOLS);
    messages.push({ role: "assistant", content: res.content || null, toolCalls: res.toolCalls });
    if (!res.toolCalls.length) {
      trace.push(`${step}: no tool call`);
      messages.push({ role: "user", content: "Gunakan tool. Kirim pesan final lewat finish(message, claims)." });
      continue;
    }
    for (const call of res.toolCalls) {
      const args = parse(call.arguments);
      let out: string;
      if (!args) out = "Argumen bukan JSON yang valid.";
      else if (call.name === "get_brief") {
        const section = String(args.section ?? "all");
        const s = run.backend.briefSection(section === "all" ? "all" : (BRIEF_SECTIONS as readonly string[]).includes(section) ? (section as BriefSection) : "all");
        if (!s) out = "Belum ada brief pemasaran.";
        else { retrieved.set(s.id, s); out = `[sumber ${s.id}]\n${s.text}`; }
        trace.push(`${step}: get_brief ${section}`);
      } else if (call.name === "search_knowledge") {
        const q = String(args.query ?? "").slice(0, 300);
        const hits = q ? await run.backend.searchKnowledge(q) : [];
        hits.forEach((h) => retrieved.set(h.id, h));
        out = hits.length ? hits.map((h) => `[sumber ${h.id}] (${h.label})\n${h.text}`).join("\n\n") : "Tidak ada hasil yang cukup relevan. Jangan mengisi sendiri; pakai sumber lain atau tulis tanpa klaim itu.";
        trace.push(`${step}: search_knowledge "${clip(q, 60)}" → ${hits.length}`);
      } else if (call.name === "get_recipient") {
        const r = run.backend.recipient();
        retrieved.set(r.id, r);
        out = `[sumber ${r.id}]\n${r.text}`;
        trace.push(`${step}: get_recipient`);
      } else if (call.name === "check_message" || call.name === "finish") {
        const message = typeof args.message === "string" ? args.message.trim() : "";
        const claims = (Array.isArray(args.claims) ? args.claims : []).flatMap((c) => {
          const o = c as { text?: unknown; source?: unknown };
          return typeof o.text === "string" && typeof o.source === "string" ? [{ text: o.text, source: o.source }] : [];
        });
        const problems = await validate(message, claims);
        trace.push(`${step}: ${call.name} → ${problems.length ? `${problems.length} masalah` : "ok"}`);
        if (call.name === "finish" && !problems.length) {
          return { message, claims, steps: step, trace, sourceIds: [...retrieved.keys()].filter((k) => k.startsWith("k:")).map((k) => k.slice(2)), sourceTexts: [...retrieved.values()].map((x) => x.text) };
        }
        out = problems.length ? `Belum lolos:\n- ${problems.join("\n- ")}\nPerbaiki pesannya (dan klaimnya), lalu coba lagi.` : "Lolos semua pemeriksaan. Panggil finish untuk mengirimkannya.";
      } else out = `Tool tidak dikenal: ${call.name}`;
      messages.push({ role: "tool", toolCallId: call.id, content: out });
    }
  }
  return null;
}
