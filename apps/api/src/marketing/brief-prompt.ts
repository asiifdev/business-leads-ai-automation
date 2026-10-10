import { SECURITY_RULE, clip } from "../ai/chat-import/style-prompt";

export interface BriefSource {
  title: string;
  url?: string | null;
  text: string;
}

export interface BriefPromptInput {
  language: "indonesian" | "english";
  /** What the user already wrote about the offer, if anything. Treated as rough notes, not as verified fact. */
  notes?: string;
  industry?: string;
  location?: string;
  sources: BriefSource[];
  /** Total characters of source text to include. */
  budget?: number;
}

/** Sources are cut evenly so one long page cannot crowd out the others. */
export function sourceDigest(sources: BriefSource[], budget = 36_000): string {
  const each = Math.max(3_000, Math.floor(budget / Math.max(1, sources.length)));
  return sources
    .map((s, i) => `<data_sumber nomor="${i + 1}" judul="${clip(s.title, 120)}"${s.url ? ` url="${clip(s.url, 200)}"` : ""}>\n${s.text.replace(/[<>]/g, "").slice(0, each)}\n</data_sumber>`)
    .join("\n\n");
}

export type BriefPass = "positioning" | "evidence" | "outreach";

/** The three passes keep each JSON small enough for modest models to get right (one big object invites misplaced keys). */
const PASS_SCHEMA: Record<BriefPass, { keys: string; template: unknown; rules: string[] }> = {
  positioning: {
    keys: "summary, overview, audience, problems, differentiation",
    template: {
      summary: "",
      overview: { oneLiner: "", whatItDoes: "", category: "", businessModel: "" },
      audience: { targetCustomers: "", decisionMakers: "", primaryUseCase: "", jobsToBeDone: [""] },
      problems: { coreProblem: "", whyAlternativesFallShort: [""], cost: "" },
      differentiation: { keyDifferentiators: [""], whyBetter: "" },
      gaps: ["[NEED: ...]"],
    },
    rules: [
      "- Positioning dulu: tentukan kategori tempat pelanggan mencarimu, apa yang membedakan dari alternatif (termasuk alternatif seperti mengerjakan sendiri atau memakai spreadsheet), nilai yang didapat pelanggan, dan pelanggan yang paling cocok.",
      "- `summary`: deskripsi layanan atau produk dalam 2 sampai 3 kalimat (maksimal 450 karakter), dari sudut pandang pemilik (\"Kami membuat ...\"): apa yang dijual, untuk siapa, dan hasil utama yang disebut di sumber. Tanpa janji angka kecuali ada di sumber.",
    ],
  },
  evidence: {
    keys: "objections, proof, offer, voice",
    template: {
      objections: [{ objection: "", response: "" }],
      proof: { metrics: [""], customers: [""], testimonials: [""] },
      offer: { pricing: "", callToAction: "" },
      voice: { tone: "", wordsToUse: [""], wordsToAvoid: [""] },
      gaps: ["[NEED: ...]"],
    },
    rules: [
      "- `objections`: array berisi objek, satu objek per keberatan (objection dan response). Keberatan yang paling mungkin muncul dari calon pelanggan, dengan jawaban jujur berdasarkan sumber. Bila sumber tidak menjawabnya, jangan isi jawaban dan catat di gaps.",
      "- `proof`: hanya angka, nama pelanggan, dan testimoni yang tertulis di sumber, disalin apa adanya. Bila tidak ada, biarkan kosong.",
      "- `offer`: harga dan ajakan bertindak hanya bila tertulis di sumber.",
      "- `voice`: nada penulisan sumber itu sendiri, dan kata yang dipakai atau dihindari sumber.",
    ],
  },
  outreach: {
    keys: "angles, campaign",
    template: {
      angles: [{ segment: "", pain: "", hook: "", benefit: "" }],
      campaign: { name: "", target: "", location: "", searchQueries: [""], contentStyle: "balanced", language: "indonesian" },
      gaps: ["[NEED: ...]"],
    },
    rules: [
      "- `angles`: 2 sampai 4 sudut pendekatan outreach, satu per SEGMEN PELANGGAN berupa jenis bisnis konkret yang bisa dicari di Google Maps (bukan kategori abstrak seperti \"korporat\" atau \"startup\"). Isi: segment, pain (masalah yang kemungkinan dirasakan segmen itu, boleh berupa hipotesis yang masuk akal), hook (satu kalimat pembuka yang berbasis fakta dari sumber), benefit (hasil konkret bagi segmen itu). Ini hipotesis untuk diuji, bukan fakta.",
      "- `campaign`: saran isian kampanye pencarian calon PELANGGAN di Google Maps, untuk dikoreksi pengguna. PELANGGAN adalah bisnis yang akan MEMBELI penawaran, BUKAN bisnis yang sejenis dengan pengguna dan bukan pesaingnya. Contoh: pengguna menjual sistem manajemen sewa, maka pelanggannya \"rental kamera\", \"rental mobil\", \"penyewaan alat pesta\" (bukan \"software house\"). Pengguna menjual jasa foto pernikahan, maka pelanggannya \"wedding organizer\", \"gedung pernikahan\", \"butik pengantin\".",
      "  `target` = jenis bisnis pelanggan yang dicari, dengan istilah Google Maps. `searchQueries` = 3 sampai 6 kata kunci pencarian untuk menemukan bisnis pelanggan itu, tanpa nama kota. `location` = kota atau wilayah HANYA bila sumber atau catatan menyebut area layanan; bila tidak, kosongkan. `name` = nama kampanye pendek. `contentStyle` = professional, friendly, balanced, atau casual sesuai suara merek. `language` = indonesian atau english sesuai pasar target.",
    ],
  },
};

/**
 * Builds the prompt for one pass of the Marketing Brief. The principles are those of the installed marketing skills
 * (product-marketing, copywriting): positioning first, customer language, specificity, no invented proof.
 * `context` carries the result of the earlier passes into the later ones.
 */
export function buildBriefMessages(input: BriefPromptInput, pass: BriefPass = "positioning", context = ""): { role: "system" | "user"; content: string }[] {
  const lang = input.language === "english" ? "English" : "Bahasa Indonesia";
  const spec = PASS_SCHEMA[pass];
  const system = [
    `Kamu product marketer senior. Tugasmu menyusun sebagian dari Marketing Brief (konteks pemasaran produk) dari materi sumber milik pengguna: bagian ${spec.keys}. Brief ini akan dibaca oleh semua modul pemasaran berikutnya (pesan outreach, konten, iklan), jadi harus akurat, spesifik, dan jujur.`,
    "",
    "PRINSIP:",
    "- Bahasa pelanggan di atas bahasa perusahaan. Manfaat di atas fitur. Spesifik di atas umum: kalimat yang bisa ditempel apa adanya di situs kompetitor harus ditulis ulang.",
    "- HANYA fakta dari sumber. Dilarang mengarang pelanggan, angka, harga, testimoni, kompetitor, penghargaan, atau klaim hasil. Bila informasinya tidak ada, kosongkan bidangnya dan tulis di `gaps` dengan format \"[NEED: apa yang dibutuhkan]\".",
    "- Jangan menulis seperti AI: tanpa kontras \"bukan X, tapi Y\", tanpa daftar negasi, tanpa pembuka klise, tanpa kata solusi, inovatif, terdepan, seamless, powerful, dan tanpa tanda pisah panjang.",
    ...spec.rules,
    `- Tulis semua isi dalam ${lang}.`,
    "",
    SECURITY_RULE,
    "",
    `Balas HANYA dengan satu objek JSON datar berbentuk persis berikut: kunci tingkat atas hanya ${spec.keys}, dan gaps. Semua kunci wajib ada; gunakan "" atau [] bila tidak ada data.`,
    JSON.stringify(spec.template),
  ].join("\n");

  const user = [
    input.industry || input.location ? `Target pasar: ${[input.industry, input.location].filter(Boolean).join(", ")}` : "",
    input.notes?.trim() ? `Catatan kasar dari pemilik (belum diverifikasi, jadikan petunjuk, bukan fakta):\n${clip(input.notes, 1500)}` : "",
    context ? `Hasil tahap sebelumnya (sudah diperiksa, gunakan sebagai konteks):\n${clip(context, 3000)}` : "",
    input.sources.length ? `Materi sumber:\n${sourceDigest(input.sources, input.budget)}` : "Tidak ada materi sumber. Susun sejauh catatan di atas mengizinkan dan isi `gaps` dengan semua yang perlu dilengkapi.",
    "Susun bagiannya sekarang.",
  ].filter(Boolean).join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
