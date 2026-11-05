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
      "- `summary`: proposisi nilai dalam 2 sampai 3 kalimat (maksimal 450 karakter) yang dibaca pemilik usaha dan langsung terasa relevan. Urutan: (1) untuk siapa dan masalah atau hasil yang mereka rasakan, dalam bahasa mereka (kalimat pertama, bukan \"Kami membuat platform ...\"); (2) apa yang kita tawarkan untuk itu, dengan nama awam, bukan daftar fitur; (3) satu pembeda paling kuat yang tertulis di sumber. Boleh memakai \"kami\" atau \"kamu\" untuk pelanggan. Tanpa janji angka kecuali ada di sumber, tanpa kata brosur (platform terintegrasi, solusi, inovatif).",
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
      "- `offer.pricing`: ringkas dalam satu sampai tiga kalimat (rentang harga dan apa yang membedakan paket), jangan menyalin seluruh tabel harga, dan hanya bila tertulis di sumber. `offer.callToAction`: SATU langkah yang diajak ke calon pelanggan, dalam kalimat (mis. mencoba gratis, meminta contoh, berkonsultasi), diambil dari apa yang benar-benar ditawarkan sumber. Daftar label tombol atau menu situs (\"Mulai dengan Pemula\", \"Lihat paket\") BUKAN ajakan.",
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
      "- `angles`: 2 sampai 4 sudut pendekatan outreach, satu per SEGMEN PELANGGAN berupa jenis bisnis konkret yang bisa dicari di Google Maps (bukan kategori abstrak seperti \"korporat\" atau \"startup\"). Isi: segment, pain (masalah yang kemungkinan dirasakan pemilik segmen itu dalam pekerjaan sehari-harinya, ditulis dalam KALIMAT UTUH dengan bahasa pemilik usaha, bukan potongan kata atau daftar fitur; boleh hipotesis yang masuk akal), hook (satu kalimat pembuka utuh yang berbasis fakta dari sumber dan bisa langsung dibaca pemilik usaha), benefit (satu atau dua kalimat utuh tentang hasil konkret bagi segmen itu: waktu, pelanggan, uang, kerepotan, bukan fitur). Pilih segmen yang paling cocok dengan apa yang sumber katakan, bukan semua yang bisa disebut. Ini hipotesis untuk diuji, bukan fakta.",
      "- `campaign`: saran isian kampanye pencarian calon PELANGGAN di Google Maps, untuk dikoreksi pengguna. PELANGGAN adalah bisnis yang akan MEMBELI penawaran, BUKAN bisnis yang sejenis dengan pengguna dan bukan pesaingnya. Contoh: pengguna menjual sistem manajemen sewa, maka pelanggannya \"rental kamera\", \"rental mobil\", \"penyewaan alat pesta\" (bukan \"software house\"). Pengguna menjual jasa foto pernikahan, maka pelanggannya \"wedding organizer\", \"gedung pernikahan\", \"butik pengantin\".",
      "  `target` = jenis bisnis pelanggan yang dicari, dengan istilah Google Maps. DILARANG diisi jabatan (manajer, direktur, pemilik), layanan atau produk pengguna (otomatisasi, software, sistem, chatbot, jasa), atau kalimat; isi hanya nama jenis tempat usaha seperti \"toko handphone\", \"klinik gigi\", \"rental mobil\". `searchQueries` = 3 sampai 6 kata kunci pencarian untuk menemukan bisnis pelanggan itu, tanpa nama kota. `location` = kota atau wilayah HANYA bila sumber atau catatan menyebut area layanan; bila tidak, kosongkan. `name` = nama kampanye pendek. `contentStyle` = professional, friendly, balanced, atau casual sesuai suara merek. `language` = indonesian atau english sesuai pasar target.",
    ],
  },
};

/** A last pass by a strict editor: it reads the draft against the sources and the marketing checklist and returns a corrected brief. */
export function buildBriefReviewMessages(input: BriefPromptInput, draftJson: string): { role: "system" | "user"; content: string }[] {
  const lang = input.language === "english" ? "English" : "Bahasa Indonesia";
  const system = [
    "Kamu editor pemasaran yang ketat. Kamu menerima DRAF Marketing Brief dan materi sumber. Periksa draf lalu kembalikan brief yang sudah diperbaiki.",
    "",
    "DAFTAR PERIKSA (perbaiki setiap yang gagal):",
    "1. Setiap fakta, angka, harga, dan klaim ada di sumber. Yang tidak ada: hapus, dan catat di gaps sebagai \"[NEED: ...]\".",
    "2. Bahasa pelanggan, bukan bahasa perusahaan atau antarmuka produk. Tulis ulang potongan kata, daftar fitur, dan label tombol atau menu menjadi kalimat utuh yang wajar dibaca pemilik usaha.",
    "2b. `summary` dibuka dengan siapa pelanggannya dan hasil atau masalah yang mereka rasakan, bukan dengan \"Kami membuat ...\" dan bukan daftar kemampuan; satu pembeda terkuat dari sumber ada di dalamnya. Bila drafnya deskripsi produk, tulis ulang menjadi proposisi nilai.",
    "3. Manfaat di atas fitur: `benefit`, `whyBetter`, dan `oneLiner` harus menyebut hasil bagi pelanggan (waktu, pelanggan, uang, kerepotan), bukan daftar kemampuan.",
    "4. `pain` dan `hook` di setiap angle spesifik untuk segmennya dan terdengar seperti pemilik usaha itu sendiri yang berbicara. Buang angle yang hanya mengulang fitur.",
    "5. `offer.callToAction` satu langkah ajakan dalam kalimat, bukan label tombol. `offer.pricing` ringkas, bukan salinan tabel.",
    "6. `voice.wordsToUse` berisi istilah yang dipakai pelanggan dan sumber, bukan jargon internal. Tanpa kata solusi, inovatif, terdepan, seamless, powerful; tanpa kontras \"bukan X, tapi Y\"; tanpa tanda pisah panjang.",
    "7. `proof` hanya yang tertulis di sumber. `gaps` berisi apa yang masih dibutuhkan, tanpa duplikat.",
    "Jangan menambah fakta baru. Pertahankan struktur dan semua kunci. `campaign.target` tetap hanya nama jenis tempat usaha pelanggan.",
    `Tulis semua isi dalam ${lang}.`,
    "",
    SECURITY_RULE,
    "",
    "Balas HANYA dengan satu objek JSON lengkap berbentuk sama dengan DRAF (summary, overview, audience, problems, differentiation, objections, proof, offer, voice, angles, campaign, gaps).",
  ].join("\n");
  const user = [
    input.notes?.trim() ? `Catatan kasar dari pemilik (petunjuk, bukan fakta):\n${clip(input.notes, 1500)}` : "",
    input.sources.length ? `Materi sumber:\n${sourceDigest(input.sources, input.budget)}` : "",
    `DRAF:\n${clip(draftJson, 14000)}`,
    "Periksa dan perbaiki sekarang.",
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

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
