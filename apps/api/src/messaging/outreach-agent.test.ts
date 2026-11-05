import test from "node:test";
import assert from "node:assert/strict";
import type { ToolCall, ToolChatMessage } from "../ai/ai-client.service";
import { runOutreachAgent, support, unsupportedNumbers, type AgentBackend } from "./outreach-agent";

const call = (id: string, name: string, args: unknown): ToolCall => ({ id, name, arguments: JSON.stringify(args) });

const backend = (over: Partial<AgentBackend> = {}): AgentBackend => ({
  searchKnowledge: async () => [{ id: "k:1", label: "Katalog", text: "Kami mencetak spanduk dan stiker dengan bahan tahan hujan, selesai dalam dua hari." }],
  briefSection: (s) => ({ id: `brief:${s}`, label: s, text: "Contoh Percetakan membuat spanduk, stiker, dan kartu nama untuk usaha kecil." }),
  recipient: () => ({ id: "recipient", label: "penerima", text: "Jenis bisnis: Toko kue" }),
  checks: () => [],
  ...over,
});

function scripted(steps: { content?: string; calls: ToolCall[] }[]) {
  let i = 0;
  const seen: ToolChatMessage[][] = [];
  return { seen, chat: async (m: ToolChatMessage[]) => { seen.push([...m]); const s = steps[Math.min(i++, steps.length - 1)]; return { content: s.content ?? "", toolCalls: s.calls }; } };
}

const good = { message: "Halo, Kak. Kami mencetak spanduk dan stiker tahan hujan untuk toko kue. Boleh kami kirim contohnya?", claims: [{ text: "mencetak spanduk dan stiker tahan hujan", source: "k:1" }] };

test("the agent reads sources with tools and finishes with a sourced message", async () => {
  const s = scripted([
    { calls: [call("a", "get_brief", { section: "offer" }), call("b", "search_knowledge", { query: "bahan" }), call("c", "get_recipient", {})] },
    { calls: [call("d", "finish", good)] },
  ]);
  const r = await runOutreachAgent({ chat: s.chat, system: "x", backend: backend() });
  assert.ok(r);
  assert.equal(r!.message, good.message);
  assert.deepEqual(r!.sourceIds, ["1"]);
});

test("a claim that cites a source the agent never retrieved is sent back", async () => {
  const s = scripted([
    { calls: [call("a", "finish", good)] },
    { calls: [call("b", "search_knowledge", { query: "bahan" })] },
    { calls: [call("c", "finish", good)] },
  ]);
  const r = await runOutreachAgent({ chat: s.chat, system: "x", backend: backend() });
  assert.equal(r!.steps, 3);
  const firstAnswer = s.seen[1].find((m) => m.role === "tool");
  assert.match((firstAnswer as { content: string }).content, /belum kamu ambil/);
});

test("a claim the source does not support is rejected", async () => {
  const bad = { message: good.message, claims: [{ text: "garansi seumur hidup untuk semua produk", source: "k:1" }] };
  const s = scripted([{ calls: [call("a", "search_knowledge", { query: "x" })] }, { calls: [call("b", "finish", bad)] }]);
  const r = await runOutreachAgent({ chat: s.chat, system: "x", backend: backend(), maxSteps: 3 });
  assert.equal(r, null);
});

test("a number that is in no source is rejected, one that is passes", () => {
  assert.deepEqual(unsupportedNumbers("Selesai dalam 3 hari, diskon 20%", ["selesai dalam 3 hari"]), ["20"]);
  assert.deepEqual(unsupportedNumbers("Cetak 1.000 stiker", ["minimal 1000 stiker"]), []);
});

test("deterministic checks and the auditor can both stop a message", async () => {
  const s = scripted([{ calls: [call("a", "search_knowledge", { query: "x" })] }, { calls: [call("b", "finish", good)] }]);
  assert.equal(await runOutreachAgent({ chat: s.chat, system: "x", backend: backend({ checks: () => ["menyebut kategori lain"] }), maxSteps: 3 }), null);
  const s2 = scripted([{ calls: [call("a", "search_knowledge", { query: "x" })] }, { calls: [call("b", "finish", good)] }]);
  assert.equal(await runOutreachAgent({ chat: s2.chat, system: "x", backend: backend({ audit: async () => ["menjanjikan pengiriman gratis"] }), maxSteps: 3 }), null);
});

test("an auditor that is down does not block a message the code accepted", async () => {
  const s = scripted([{ calls: [call("a", "search_knowledge", { query: "x" })] }, { calls: [call("b", "finish", good)] }]);
  const r = await runOutreachAgent({ chat: s.chat, system: "x", backend: backend({ audit: async () => { throw new Error("down"); } }) });
  assert.ok(r);
});

test("bad tool arguments and a model that never calls tools end in null, not a crash", async () => {
  const s = scripted([{ calls: [{ id: "a", name: "finish", arguments: "{not json" }] }, { calls: [] }]);
  assert.equal(await runOutreachAgent({ chat: s.chat, system: "x", backend: backend(), maxSteps: 4 }), null);
});

test("support compares content words, ignoring inflection prefixes", () => {
  assert.ok(support("mencetak spanduk tahan hujan", "Kami mencetak spanduk dengan bahan tahan hujan") >= 0.9);
  assert.ok(support("garansi seumur hidup", "Kami mencetak spanduk") < 0.5);
});
