/**
 * Rules a first message must pass before it is shown. These protect the owner (no invented clients, no promise of a product that does
 * not exist, no stub); they do not police style: the prompt gives the writer freedom, the check only catches what must never go out.
 * A draft that fails is written again with the reasons.
 */
const PRODUCT_PITCH = /\b(demo|contoh\s+tampilan|uji\s+coba|coba\s+gratis|aplikasi\s+kami|sistem\s+kami|platform\s+kami)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `caseStudies`: names of clients and case studies in the owner's own brief. A first message to a stranger must not name them, unless the
 * stranger is that business (the name is in their own name or category).
 */
export function outreachProblems(text: string, o: { service: boolean; category?: string | null; caseStudies?: string[] }): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (t.length < 60) problems.push("terlalu pendek");
  if (o.service && PRODUCT_PITCH.test(t)) problems.push("menawarkan demo atau produk jadi, padahal ini jasa sesuai kebutuhan");
  for (const name of (o.caseStudies ?? []).filter((n) => n.trim().length >= 3).slice(0, 12)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name.trim())}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(t) && !re.test(o.category ?? "")) problems.push(`menyebut klien atau studi kasus yang tidak terkait penerima: "${name.trim()}"`);
  }
  return problems;
}
