import { languageName } from "../common/language";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiClientService } from "./ai-client.service";
import { SECURITY_RULE, clip } from "./chat-import/style-prompt";
import type { FitLevel, FitVerdict } from "./lead-intelligence.service";

const BATCH = 20;
const MAX_LEADS = 200;

export interface FitCandidate {
  name: string;
  category?: string;
}

/** One line per lead: the business name and its real Google Maps category are both evidence. */
export function buildFitMessages(input: { offer: string; targets: string; language: string; leads: FitCandidate[] }) {
  const lang = languageName(input.language);
  return [
    {
      role: "system" as const,
      content: [
        "Kamu analis penjualan. Untuk setiap bisnis di bawah (nama dan kategori Google Maps-nya), nilai seberapa mungkin bisnis itu membutuhkan atau membeli penawaran pengguna.",
        "- high: jelas pengguna utama penawaran. medium: mungkin membutuhkan. low: jarang atau tidak relevan.",
        "- Nama dan kategori sama-sama bukti. Kategori bisa terlalu umum (mis. Toko Kamera), dan nama bisa menunjukkan kegiatan sebenarnya (mis. Rental Kamera); gabungkan keduanya.",
        "- Dasarkan penilaian HANYA pada penawaran, target, nama, dan kategori yang diberikan. Jangan mengarang fakta tentang bisnisnya.",
        "- Bila nama bisnis memuat kata yang menunjukkan kegiatan yang sama dengan target penawaran (mis. rental, sewa, penyewaan), nilai minimal medium, dan high bila kegiatan itu jelas menjadi inti bisnisnya. Jangan menurunkan nilai hanya karena kategori Maps-nya umum.",
        `- reason: satu kalimat pendek dalam ${lang} yang menyebut buktinya (maksimal 110 karakter).`,
        SECURITY_RULE,
        'Balas HANYA JSON: {"results":[{"n":1,"fit":"high|medium|low","reason":"..."}]} dengan satu entri per nomor.',
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `Penawaran: ${clip(input.offer, 700)}`,
        input.targets ? `Target pelanggan menurut brief: ${clip(input.targets, 700)}` : "",
        `<data_bisnis>\n${input.leads.map((l, i) => `${i + 1}. ${clip(l.name, 100)} | ${clip(l.category ?? "", 80) || "(kategori tidak diketahui)"}`).join("\n")}\n</data_bisnis>`,
      ].filter(Boolean).join("\n\n"),
    },
  ];
}

/** Returns one verdict (or undefined) per input lead, in the same order. */
export function parseFit(raw: string, count: number): (FitVerdict | undefined)[] {
  const out: (FitVerdict | undefined)[] = Array.from({ length: count }, () => undefined);
  let data: unknown;
  try {
    const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    data = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  } catch {
    return out;
  }
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results)) return out;
  for (const r of results as { n?: unknown; fit?: unknown; reason?: unknown }[]) {
    const n = typeof r.n === "number" ? r.n : Number(r.n);
    const fit = typeof r.fit === "string" ? (r.fit.toLowerCase() as FitLevel) : undefined;
    if (Number.isInteger(n) && n >= 1 && n <= count && fit && ["high", "medium", "low"].includes(fit)) {
      out[n - 1] = { fit, reason: typeof r.reason === "string" ? clip(r.reason, 140) : "" };
    }
  }
  return out;
}

/** Judges, per scraped business, how well it fits the offer. Needs an AI provider; without one nothing is assumed. */
@Injectable()
export class FitService {
  private readonly logger = new Logger(FitService.name);

  constructor(private readonly prisma: PrismaService, private readonly ai: AiClientService) {}

  async assess(workspaceId: string, leads: FitCandidate[], offer: string, language: string): Promise<(FitVerdict | undefined)[]> {
    const none = leads.map(() => undefined);
    const ai = await this.ai.forWorkspace(workspaceId);
    if (!ai.enabled || leads.length === 0 || !offer.trim()) return none;
    const brief = await this.prisma.marketingBrief.findUnique({ where: { workspaceId }, select: { summary: true, content: true } });
    const content = brief?.content as { audience?: { targetCustomers?: string }; angles?: { segment?: string }[] } | null;
    const targets = [content?.audience?.targetCustomers, ...(content?.angles ?? []).map((a) => a.segment)].filter(Boolean).join("; ");
    const out = [...none];
    const capped = Math.min(leads.length, MAX_LEADS);
    for (let from = 0; from < capped; from += BATCH) {
      const slice = leads.slice(from, Math.min(from + BATCH, capped));
      try {
        const reply = await ai.chat(buildFitMessages({ offer: brief?.summary || offer, targets, language, leads: slice }), { json: true, temperature: 0.1 });
        parseFit(reply, slice.length).forEach((v, i) => { out[from + i] = v; });
      } catch (e) {
        this.logger.warn(`Fit assessment skipped for a batch: ${(e as Error).message}`);
      }
    }
    return out;
  }
}
