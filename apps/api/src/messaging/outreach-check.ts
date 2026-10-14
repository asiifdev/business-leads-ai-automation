/**
 * Rules a first message must pass before it is shown. The prompt asks for these too, but a model ignores a prompt now and then;
 * a check in code does not. A draft that fails is written again with the reasons.
 */
const QUESTION_WORD = /\b(apakah|apa|bagaimana|kapan|siapa|di\s*mana|mengapa|kenapa|berapa|adakah|pernahkah|bolehkah|bisakah)\b/i;
const SLANG = /\b(bikin|gimana|ngobrol(-ngobrol)?|santai|nggak|ngga|gak|diskusiin|kabari\s+saja|sistem\s+bantu|pakai\s+teknologi|urusan\s+bisnis)\b/i;
const PRODUCT_PITCH = /\b(demo|contoh\s+tampilan|uji\s+coba|coba\s+gratis|aplikasi\s+kami|sistem\s+kami|platform\s+kami)\b/i;
const JARGON = /\b(di\s+produksi|engineering|RAG|asisten\s+dokumen|pipeline|stack)\b/i;
const INTRO = /\b(perkenalkan|saya\s+dari|kami\s+dari|saya\s+[a-z]+\s+dari)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `caseStudies`: names of clients and case studies in the owner's own brief. A first message to a stranger must not name them, unless the
 * stranger is that business (the name is in their own name or category).
 */
export function outreachProblems(text: string, o: { service: boolean; category?: string | null; caseStudies?: string[] }): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (t.length < 60) problems.push("terlalu pendek");
  // every sentence that ends in "?" needs a question word: "Kira-kira ada kebutuhan itu?" reads like a statement with a mark
  const sentences = t.split(/(?<=[.!?])\s+|\n+/);
  const bad = sentences.find((s) => s.trim().endsWith("?") && !QUESTION_WORD.test(s));
  if (bad) problems.push(`kalimat tanya tanpa kata tanya (apakah, apa, bagaimana, kapan): "${bad.trim().slice(0, 80)}"`);
  const slang = t.match(SLANG);
  if (o.service && slang) problems.push(`bahasa kurang baku atau kabur: "${slang[0]}"`);
  const jargon = t.match(JARGON);
  if (o.service && jargon) problems.push(`istilah teknis yang tidak dipahami pemilik usaha: "${jargon[0]}"`);
  if (o.service && !INTRO.test(t)) problems.push("belum memperkenalkan diri dengan kalimat seperti \"Perkenalkan, saya dari ...\"");
  if (o.service && PRODUCT_PITCH.test(t)) problems.push("menawarkan demo atau produk jadi, padahal ini jasa sesuai kebutuhan");
  for (const name of (o.caseStudies ?? []).filter((n) => n.trim().length >= 3).slice(0, 12)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name.trim())}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(t) && !re.test(o.category ?? "")) problems.push(`menyebut klien atau studi kasus yang tidak terkait penerima: "${name.trim()}"`);
  }
  return problems;
}
