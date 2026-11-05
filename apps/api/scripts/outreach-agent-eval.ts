/**
 * Runs the first-message agent against invented offers and many kinds of recipient, with the real model and an in-memory
 * knowledge base, and prints the message, the tool trace and the problems the checks raised on the way.
 *   OPENAI_API_KEY=... OPENAI_MODEL=... [OPENAI_BASE_URL=...] pnpm --filter @prospex/api exec tsx scripts/outreach-agent-eval.ts
 * All data below is invented (example businesses); nothing here comes from a real workspace.
 */
import { WorkspaceAi } from "../src/ai/ai-client.service";
import { runOutreachAgent, type AgentBackend } from "../src/messaging/outreach-agent";
import { agentSystemPrompt, briefSectionSource } from "../src/messaging/outreach-agent-prompt";
import { outreachProblems } from "../src/messaging/outreach-check";
import { draftRisks } from "../src/messaging/draft-risk";
import type { BriefContent } from "../src/marketing/brief-schema";

const brief = (o: Partial<BriefContent> & { summary: string }): { summary: string; content: BriefContent } => ({
  summary: o.summary,
  content: {
    overview: { oneLiner: "", whatItDoes: o.summary, category: "", businessModel: "" },
    audience: { targetCustomers: "", decisionMakers: "", primaryUseCase: "", jobsToBeDone: [] },
    problems: { coreProblem: "", whyAlternativesFallShort: [], cost: "" },
    differentiation: { keyDifferentiators: [], whyBetter: "" },
    objections: [], proof: { metrics: [], customers: [], testimonials: [] }, offer: { pricing: "", callToAction: "" },
    voice: { tone: "", wordsToUse: [], wordsToAvoid: [] }, angles: [], gaps: [],
    ...o,
  } as BriefContent,
});

const OFFERS = [
  { name: "Contoh Kasir Toko", kind: "product" as const, ...brief({ summary: "Kami membuat aplikasi kasir dan toko online untuk pedagang. Katalog ditulis sekali, stok tercatat sama di kasir dan toko online. Pembayaran online tercatat lunas otomatis.", gaps: ["[NEED: harga paket]"] }),
    knowledge: ["Satu katalog dipakai untuk kasir dan toko online, stok dikurangi otomatis di keduanya.", "Varian seperti ukuran, warna, atau rasa bisa dicatat per barang.", "Pembayaran online tercatat lunas tanpa dicek manual."] },
  { name: "Contoh Kemasan", kind: "product" as const, ...brief({ summary: "Kami mencetak kemasan custom (box, kantong, label) untuk usaha makanan dan produk rumahan, minimal pesan kecil, desain dibantu.", gaps: ["[NEED: harga]"] }),
    knowledge: ["Box, kantong kertas, dan label stiker bisa dicetak dengan logo usaha sendiri.", "Pesanan minimal kecil supaya usaha rumahan bisa mulai.", "Tim membantu menyiapkan desain dari logo yang sudah ada."] },
  { name: "Contoh Mebel Jati", kind: "service" as const, ...brief({ summary: "Kami membuat mebel jati custom (pintu, kusen, lemari, kamar set) sesuai ukuran dan desain pelanggan, termasuk pengiriman dan pemasangan.", gaps: ["[NEED: harga]"] }),
    knowledge: ["Pintu, kusen, jendela, lemari, dan kamar set dibuat sesuai ukuran pesanan.", "Pengerjaan oleh pengrajin, termasuk pengiriman dan pemasangan."] },
  { name: "Contoh Servis Armada", kind: "service" as const, ...brief({ summary: "Kami menyediakan servis dan perawatan berkala untuk motor dan mobil operasional usaha, dengan jadwal rutin dan catatan servis per kendaraan.", gaps: [] }),
    knowledge: ["Jadwal servis berkala dicatat per kendaraan dan diingatkan ke pemilik.", "Catatan servis tiap kendaraan bisa dilihat kapan saja."] },
];
const NICHES = ["Toko kue", "Bengkel motor", "Butik fashion", "Percetakan", "Konveksi", "Warung makan", "Toko bangunan", "Hotel kecil"];

const ai = new WorkspaceAi({ source: "server", apiKey: process.env.OPENAI_API_KEY ?? "", baseURL: process.env.OPENAI_BASE_URL, chatModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini", embeddingModel: "", reasoningEffort: process.env.OPENAI_REASONING_EFFORT });

const words = (s: string) => s.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);

async function one(offer: (typeof OFFERS)[number], niche: string) {
  const backend: AgentBackend = {
    searchKnowledge: async (q) => {
      const qw = new Set(words(q));
      return offer.knowledge.map((t, i) => ({ t, i, s: words(t).filter((w) => qw.has(w)).length })).filter((x) => x.s > 0 || offer.knowledge.length <= 2).slice(0, 3).map((x) => ({ id: `k:${offer.name}-${x.i}`, label: "Pengetahuan", text: x.t }));
    },
    briefSection: (s) => briefSectionSource(offer.summary, offer.content, s),
    recipient: () => ({ id: "recipient", label: "penerima", text: `Jenis bisnis penerima: ${niche}\n(Satu pesan untuk banyak bisnis sejenis.)` }),
    checks: (m, texts) => [...outreachProblems(m, { service: offer.kind === "service", category: niche }), ...draftRisks(m, texts).map((r) => `menyebut ${r} yang tidak ada di sumber`)],
    audit: async (message, sources) => {
      const raw = await ai.chat([
        { role: "system", content: 'Kamu auditor fakta. Daftarkan pernyataan faktual di PESAN yang TIDAK didukung SUMBER (fitur, cara kerja, angka, harga, jaminan, pengalaman, keadaan penerima). Sapaan, pertanyaan, ajakan, dan kemungkinan yang dinyatakan sebagai pertanyaan bukan pelanggaran. Balas JSON {"unsupported":["kutipan: alasan"]}.' },
        { role: "user", content: `<sumber>\n${sources.map((s) => s.text).join("\n\n")}\n</sumber>\n<pesan>\n${message}\n</pesan>` },
      ], { temperature: 0, json: true });
      try { return (JSON.parse(raw).unsupported as string[]).map((x) => `auditor: ${x}`); } catch { return []; }
    },
  };
  const t0 = Date.now();
  const r = await runOutreachAgent({
    chat: (m, t) => ai.chatWithTools(m, t, { temperature: 0.8 }),
    system: agentSystemPrompt({ language: "indonesian", channel: "whatsapp", business: offer.name, offer: offer.summary, recipientKind: niche, generic: true, offerKind: offer.kind }),
    backend,
  });
  console.log(`\n=== ${offer.name} -> ${niche} | ${r ? `${r.steps} langkah` : "GAGAL"} | ${Math.round((Date.now() - t0) / 1000)}s\n${r?.trace.join(" | ") ?? ""}\n${r?.message ?? "(tidak ada pesan lolos)"}`);
  return !!r;
}

(async () => {
  let ok = 0, total = 0;
  const only = process.argv[2];
  for (const o of OFFERS) for (const n of NICHES) {
    if (only && !`${o.name} ${n}`.toLowerCase().includes(only.toLowerCase())) continue;
    total++;
    try { if (await one(o, n)) ok++; } catch (e) { console.log(`\n=== ${o.name} -> ${n} | ERROR ${(e as Error).message}`); }
  }
  console.log(`\nLolos: ${ok}/${total}`);
})();
