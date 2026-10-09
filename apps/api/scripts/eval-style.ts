/**
 * Offline evaluation: does style-aware drafting sound more like the owner than a generic prompt?
 *
 *   EXPORT_DIR=/path/to/extracted/exports ME="Asiifdev Digital Agency" \
 *   OPENAI_BASE_URL=http://localhost:11434/v1 CHAT_MODEL=gemma4:latest EMBEDDING_MODEL=qwen3-embedding:latest \
 *   node --import tsx scripts/eval-style.ts
 *
 * The last 15% of each chat (by time) is held out as the test set; examples come only from the first 85%.
 * Nothing here is committed with data: point EXPORT_DIR at your own exports.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { anonymize } from "../src/ai/chat-import/anonymize";
import { buildDraftMessages, cosine } from "../src/ai/chat-import/style-prompt";
import { buildReplyPairs, computeStyleStats, type ReplyPair } from "../src/ai/chat-import/style-stats";
import { parseWhatsAppExport } from "../src/ai/chat-import/whatsapp-export-parser";

const dir = process.env.EXPORT_DIR!;
const me = process.env.ME!;
const base = (process.env.OPENAI_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, "");
const chatModel = process.env.CHAT_MODEL ?? "gemma4:latest";
const embModel = process.env.EMBEDDING_MODEL ?? "qwen3-embedding:latest";
const N = Number(process.env.SAMPLES ?? 30);
const out = process.env.OUT ?? "/tmp/eval-style-samples.json";
const headers = { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY ?? "ollama"}` };

async function post(path: string, body: unknown) {
  const res = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(300_000) });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json() as Promise<any>;
}
const chat = async (messages: any[], temperature = 0.7) => ((await post("/chat/completions", { model: chatModel, messages, temperature })).choices[0].message.content ?? "").trim();
async function embed(texts: string[]) {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) all.push(...(await post("/embeddings", { model: embModel, input: texts.slice(i, i + 32) })).data.map((d: any) => d.embedding));
  return all;
}

function files(d: string): string[] {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? files(p) : n.endsWith(".txt") ? [p] : [];
  });
}

const train: ReplyPair[] = [];
const test: ReplyPair[] = [];
const allMine: any[] = [];
for (const f of files(dir)) {
  const chatData = parseWhatsAppExport(readFileSync(f, "utf8"));
  if (!chatData.senders.includes(me)) continue;
  const cut = chatData.messages[Math.floor(chatData.messages.length * 0.85)]?.at.getTime() ?? 0;
  const before = chatData.messages.filter((m) => m.at.getTime() < cut);
  allMine.push(...before);
  const pairs = buildReplyPairs(chatData.messages, me);
  for (const p of pairs) (p.at.getTime() < cut ? train : test).push({ ...p, incoming: anonymize(p.incoming), reply: anonymize(p.reply) });
}
const style = computeStyleStats(allMine, me);
const usable = (p: ReplyPair) => p.incoming.length <= 400 && p.reply.length <= 400 && p.reply.length > 1;
const trainPairs = train.filter(usable);
const testPairs = test.filter(usable).filter((_, i) => i % Math.max(1, Math.floor(test.length / N)) === 0).slice(0, N);
console.log(`train pairs ${trainPairs.length}, test pairs ${testPairs.length}, my messages in train ${style.messageCount}`);

const BASE_SYSTEM = "Kamu adalah admin sebuah bisnis rental. Balas pesan pelanggan WhatsApp dengan sopan, jelas, dan membantu dalam Bahasa Indonesia. Tulis HANYA isi pesan balasan.";
const stat = (s: string) => ({ len: s.length, emoji: /\p{Extended_Pictographic}/u.test(s), lower: /^\p{Ll}/u.test(s), end: /[.!?]$/.test(s.trim()) });

const run = async () => {
  const trainVecs = await embed(trainPairs.map((p) => p.incoming));
  const rows: any[] = [];
  for (const [i, t] of testPairs.entries()) {
    const [qv] = await embed([t.incoming]);
    const examples = trainVecs.map((v, j) => ({ j, s: cosine(qv, v) })).sort((a, b) => b.s - a.s).slice(0, 5).map((x) => trainPairs[x.j]);
    const baseline = await chat([{ role: "system", content: BASE_SYSTEM }, { role: "user", content: `Pelanggan: ${t.incoming}\nBalasan:` }]);
    const styled = await chat(buildDraftMessages({ businessDescription: "bisnis rental dan software sistem rental (Asiifdev Digital Agency)", style, examples, incoming: t.incoming }));
    // blind judge: which candidate is closer to the real reply in tone, length and wording?
    const flip = i % 2 === 1;
    const [A, B] = flip ? [styled, baseline] : [baseline, styled];
    const verdict = (await chat([{ role: "user", content: `Balasan asli pemilik: """${t.reply}"""\n\nKandidat A: """${A}"""\n\nKandidat B: """${B}"""\n\nKandidat mana yang paling mirip dengan balasan asli dalam nada, panjang, dan pilihan kata? Jawab hanya satu huruf: A atau B.` }], 0)).match(/[AB]/)?.[0];
    const styledWon = verdict ? (verdict === "A") === flip : null;
    rows.push({ incoming: t.incoming, real: t.reply, baseline, styled, styledWon });
    console.log(`[${i + 1}/${testPairs.length}] real ${t.reply.length} | baseline ${baseline.length} | styled ${styled.length} | winner ${styledWon === null ? "?" : styledWon ? "styled" : "baseline"}`);
    writeFileSync(out, JSON.stringify(rows, null, 1));
  }
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / (xs.length || 1));
  const lenErr = (k: "baseline" | "styled") => mean(rows.map((r) => Math.abs(Math.log((r[k].length + 1) / (r.real.length + 1))) * 100)) / 100;
  const rate = (k: "baseline" | "styled", f: (s: ReturnType<typeof stat>) => boolean) => Math.round((rows.filter((r) => f(stat(r[k]))).length / rows.length) * 100);
  const judged = rows.filter((r) => r.styledWon !== null);
  console.log("\n=== RESULT ===");
  console.log("avg chars  real", mean(rows.map((r) => r.real.length)), "| baseline", mean(rows.map((r) => r.baseline.length)), "| styled", mean(rows.map((r) => r.styled.length)));
  console.log("length error (|ln ratio|, lower=better)  baseline", lenErr("baseline"), "| styled", lenErr("styled"));
  console.log("emoji %    real", Math.round((rows.filter((r) => stat(r.real).emoji).length / rows.length) * 100), "| baseline", rate("baseline", (s) => s.emoji), "| styled", rate("styled", (s) => s.emoji));
  console.log("lower-start % real", Math.round((rows.filter((r) => stat(r.real).lower).length / rows.length) * 100), "| baseline", rate("baseline", (s) => s.lower), "| styled", rate("styled", (s) => s.lower));
  console.log("judge: styled closer to real in", judged.filter((r) => r.styledWon).length, "of", judged.length);
};
run().catch((e) => { console.error(e); process.exit(1); });
