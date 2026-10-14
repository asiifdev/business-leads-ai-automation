/**
 * Is the owner selling a finished product (an app that exists, can be demoed, has a trial) or a custom service
 * (an agency that builds software to order: nothing exists yet to show)? The two need different first messages:
 * a product pitch says "here is a system"; an agency intro says "we can build what you need, let's talk".
 */
export type OfferKind = "product" | "service";

const SERVICE = /\b(custom|kustom|outsourc\w*|agency|agensi|software\s+house|jasa|pembuatan|pengembangan|konsultan|consult\w*|we\s+build|kami\s+(membangun|mengembangkan|menerima|menyediakan\s+(jasa|tim)))\b/gi;
const PRODUCT = /\b(langganan|subscription|saas|free\s+trial|masa\s+coba|uji\s+coba|coba\s+gratis|paket\s+(harian|bulanan|tahunan)|kasir|dashboard\s+siap|siap\s+pakai|ready[\s-]?to[\s-]?use)\b/gi;

const count = (re: RegExp, text: string) => (text.match(re) ?? []).length;

/** Service wins unless the text clearly describes a ready product: an agency's brief often says "sistem" and "aplikasi" too. */
export function detectOfferKind(...texts: (string | null | undefined)[]): OfferKind {
  const text = texts.filter(Boolean).join("\n").slice(0, 4000);
  return count(SERVICE, text) > count(PRODUCT, text) ? "service" : "product";
}
