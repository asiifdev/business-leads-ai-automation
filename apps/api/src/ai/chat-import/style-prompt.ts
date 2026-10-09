import type { StyleStats, ReplyPair } from "./style-stats";

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Human-readable description of measured writing habits, fed to the model as a style guide. */
export function describeStyle(s: StyleStats): string {
  const lines = [
    `Panjang balasan: rata-rata ${s.avgChars} karakter (median ${s.medianChars}), sekitar ${s.avgWords} kata. Jangan jauh lebih panjang dari itu.`,
    `Emoji muncul di ${pct(s.emojiRate)} pesan${s.topEmoji.length ? ` (paling sering: ${s.topEmoji.slice(0, 3).map((e) => e.emoji).join(" ")})` : ""}.`,
    `Tanda seru di ${pct(s.exclamationRate)} pesan; pesan diawali huruf kecil di ${pct(s.lowercaseStartRate)}; tanpa tanda baca di akhir pada ${pct(s.noEndPunctuationRate)}.`,
    `Pesan multi-baris hanya ${pct(s.multiLineRate)}.`,
  ];
  if (s.topOpeners.length) lines.push(`Kata pembuka yang sering dipakai: ${s.topOpeners.slice(0, 5).map((o) => o.word).join(", ")}.`);
  if (s.topClosers.length) lines.push(`Kata penutup yang sering dipakai: ${s.topClosers.slice(0, 5).map((o) => o.word).join(", ")}.`);
  return lines.join("\n");
}

export interface DraftPromptInput {
  businessDescription: string;
  style: StyleStats;
  examples: ReplyPair[];
  /** Facts retrieved from the knowledge base; the model may only state facts found here. */
  knowledge?: string[];
  incoming: string;
}

/** Builds chat messages for drafting a reply in the owner's own voice. */
export function buildDraftMessages(input: DraftPromptInput): { role: "system" | "user"; content: string }[] {
  const shots = input.examples
    .map((e, i) => `Contoh ${i + 1}\nPelanggan: ${e.incoming}\nBalasan saya: ${e.reply}`)
    .join("\n\n");
  const facts = input.knowledge?.length
    ? `\nFAKTA YANG BOLEH DIPAKAI (jangan menyebut harga, jadwal, atau kebijakan yang tidak ada di sini):\n${input.knowledge.map((k) => `- ${k}`).join("\n")}\n`
    : "\nTidak ada fakta bisnis yang diberikan: jangan menyebut harga, jadwal, atau kebijakan; tanyakan atau katakan akan dicek.\n";
  const system = [
    `Kamu menulis balasan WhatsApp atas nama pemilik bisnis ini: ${input.businessDescription}`,
    "Tirulah cara menulis pemilik, bukan gaya asisten AI. Jangan memakai kalimat basa-basi yang tidak ada di contoh.",
    "",
    "GAYA MENULIS PEMILIK (diukur dari chat aslinya):",
    describeStyle(input.style),
    facts,
    "CONTOH BALASAN ASLI PEMILIK pada situasi serupa:",
    shots || "(belum ada contoh)",
    "",
    "Tulis HANYA isi pesan balasan, tanpa penjelasan, tanpa tanda kutip, tanpa label.",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Pelanggan: ${input.incoming}\nBalasan saya:` },
  ];
}
