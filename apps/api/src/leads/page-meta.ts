/**
 * What a page says about itself in its head: meta and Open Graph tags, and schema.org JSON-LD. Plain index searches over a bounded
 * window, so no input can make it slow. Only text the business (or its platform) published for link previews and search engines.
 */
import { phoneDigitsFor } from "../messaging/phone-intl";

const HEAD_WINDOW = 200_000;
const MAX_TAGS = 300;
const MAX_JSONLD_BYTES = 200_000;
const MAX_JSONLD_NODES = 300;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };
export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-z]{2,6});/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e] ?? m;
  });
}

/** Attribute value inside one tag's text, e.g. content="..." (either quote style). */
function attr(tag: string, name: string): string | null {
  const lower = tag.toLowerCase();
  let from = 0;
  for (let i = 0; i < 20; i++) {
    const at = lower.indexOf(name, from);
    if (at < 0) return null;
    from = at + name.length;
    const before = lower[at - 1];
    if (before !== " " && before !== "\n" && before !== "\t" && before !== "\r") continue;
    let p = at + name.length;
    while (lower[p] === " ") p++;
    if (lower[p] !== "=") continue;
    p++;
    while (lower[p] === " ") p++;
    const q = tag[p];
    if (q === '"' || q === "'") {
      const end = tag.indexOf(q, p + 1);
      return end < 0 ? null : tag.slice(p + 1, end);
    }
    const end = tag.slice(p).search(/[\s>]/);
    return tag.slice(p, end < 0 ? undefined : p + end);
  }
  return null;
}

export interface PageMeta {
  title: string;
  description: string;
  /** og:site_name, og:type and similar, by lowercase key. */
  og: Record<string, string>;
  /** Every meta tag by lowercase name or property ("description", "og:title", ...). */
  tags: Record<string, string>;
  jsonld: unknown[];
}

export function readPageMeta(html: string): PageMeta {
  const head = html.slice(0, HEAD_WINDOW);
  const lower = head.toLowerCase();
  const meta: Record<string, string> = {};
  let from = 0;
  for (let n = 0; n < MAX_TAGS; n++) {
    const s = lower.indexOf("<meta", from);
    if (s < 0) break;
    const e = head.indexOf(">", s);
    if (e < 0) break;
    from = e + 1;
    const tag = head.slice(s, e + 1);
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content !== null && !(key in meta)) meta[key] = decodeEntities(content).replace(/\s+/g, " ").trim().slice(0, 1000);
  }
  let title = "";
  const t0 = lower.indexOf("<title");
  if (t0 >= 0) {
    const gt = head.indexOf(">", t0);
    const t1 = gt < 0 ? -1 : lower.indexOf("</title>", gt);
    if (gt >= 0 && t1 >= 0) title = decodeEntities(head.slice(gt + 1, t1)).replace(/\s+/g, " ").trim().slice(0, 200);
  }
  const og: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) if (k.startsWith("og:")) og[k.slice(3)] = v;

  const jsonld: unknown[] = [];
  const whole = html.slice(0, 1_500_000);
  const wl = whole.toLowerCase();
  let pos = 0;
  for (let n = 0; n < 10; n++) {
    const s = wl.indexOf("application/ld+json", pos);
    if (s < 0) break;
    const gt = whole.indexOf(">", s);
    const end = gt < 0 ? -1 : wl.indexOf("</script>", gt);
    if (gt < 0 || end < 0) break;
    pos = end + 9;
    if (end - gt > MAX_JSONLD_BYTES) continue;
    try { jsonld.push(JSON.parse(whole.slice(gt + 1, end))); } catch { /* a broken block is common; skip it */ }
  }
  return { title: og.title || title, description: og.description || meta.description || "", og, tags: meta, jsonld };
}

export interface BusinessInfo {
  /** The business name the page states in its structured data. */
  name?: string;
  description?: string;
  /** schema.org type, e.g. Restaurant, HairSalon. */
  type?: string;
  hours?: string;
  address?: string;
  priceRange?: string;
  phones: string[];
  emails: string[];
  sameAs: string[];
}

const BUSINESS_TYPE = /(LocalBusiness|Store|Restaurant|Cafe|Bakery|Salon|Barber|Hotel|Clinic|Dentist|Pharmacy|Gym|Service|Shop|Organization|Corporation|Studio|School|Agency|Repair|Dealer|Laundry|Florist|Spa)/;

function text(v: unknown, max = 300): string {
  return typeof v === "string" ? decodeEntities(v).replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function addressText(a: unknown): string {
  if (typeof a === "string") return text(a);
  if (!a || typeof a !== "object") return "";
  const o = a as Record<string, unknown>;
  return [text(o.streetAddress), text(o.addressLocality), text(o.addressRegion), text(o.postalCode)].filter(Boolean).join(", ").slice(0, 300);
}

function hoursText(node: Record<string, unknown>): string {
  const plain = node.openingHours;
  if (typeof plain === "string") return text(plain);
  if (Array.isArray(plain)) return plain.map((x) => text(x, 60)).filter(Boolean).slice(0, 8).join("; ");
  const spec = node.openingHoursSpecification;
  const list = Array.isArray(spec) ? spec : spec ? [spec] : [];
  return list.slice(0, 8).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const day = (d: unknown) => text(d, 80).replace(/^.*\//, "").slice(0, 20);
    const days = Array.isArray(o.dayOfWeek) ? o.dayOfWeek.map(day).join("/") : day(o.dayOfWeek);
    return [days, [text(o.opens, 8), text(o.closes, 8)].filter(Boolean).join("-")].filter(Boolean).join(" ");
  }).filter(Boolean).join("; ").slice(0, 300);
}

/** Walks JSON-LD with a hard cap on nodes and depth; yields objects. */
function* nodes(root: unknown): Generator<Record<string, unknown>> {
  let seen = 0;
  const stack: [unknown, number][] = [[root, 0]];
  while (stack.length && seen < MAX_JSONLD_NODES) {
    const [v, depth] = stack.pop()!;
    if (Array.isArray(v)) { if (depth < 6) for (const x of v.slice(0, 50)) stack.push([x, depth + 1]); continue; }
    if (!v || typeof v !== "object") continue;
    seen++;
    const o = v as Record<string, unknown>;
    yield o;
    if (depth < 6 && o["@graph"]) stack.push([o["@graph"], depth + 1]);
  }
}

/** Business details a site states about itself. Nothing is inferred: a field is present only when the page says it. */
export function extractBusinessInfo(meta: PageMeta, country = "ID"): BusinessInfo {
  const info: BusinessInfo = { phones: [], emails: [], sameAs: [] };
  for (const root of meta.jsonld) {
    for (const o of nodes(root)) {
      const t = [o["@type"]].flat().map((x) => text(x, 40)).find((x) => BUSINESS_TYPE.test(x));
      if (!t) continue;
      info.type ??= t;
      info.name ??= text(o.name, 120) || undefined;
      info.description ??= text(o.description) || undefined;
      info.address ??= addressText(o.address) || undefined;
      info.hours ??= hoursText(o) || undefined;
      info.priceRange ??= text(o.priceRange, 40) || undefined;
      for (const p of [o.telephone].flat()) {
        const n = typeof p === "string" ? phoneDigitsFor(p.split(/[;,/]/)[0].trim(), country) : null;
        if (n && !info.phones.includes(n) && info.phones.length < 3) info.phones.push(n);
      }
      for (const e of [o.email].flat()) {
        const v = text(e, 120).toLowerCase().replace(/^mailto:/, "");
        if (/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/.test(v) && !info.emails.includes(v) && info.emails.length < 3) info.emails.push(v);
      }
      for (const s of [o.sameAs].flat()) {
        const v = text(s, 200);
        if (/^https?:\/\//i.test(v) && !info.sameAs.includes(v) && info.sameAs.length < 8) info.sameAs.push(v);
      }
    }
  }
  const description = info.description || meta.description;
  if (description) info.description = description.slice(0, 300);
  else delete info.description;
  for (const k of ["name", "description", "type", "hours", "address", "priceRange"] as const) if (!info[k]) delete info[k];
  return info;
}

const empty = (i: Partial<BusinessInfo>) => !(i.name || i.description || i.type || i.hours || i.address || i.priceRange || i.phones?.length || i.emails?.length || i.sameAs?.length);

/** The first page's value wins for each field; lists are joined. */
export function mergeBusinessInfo(list: Partial<BusinessInfo>[]): BusinessInfo {
  const out: BusinessInfo = { phones: [], emails: [], sameAs: [] };
  for (const i of list) {
    for (const k of ["name", "description", "type", "hours", "address", "priceRange"] as const) if (!out[k] && i[k]) out[k] = i[k];
    for (const k of ["phones", "emails", "sameAs"] as const) for (const v of i[k] ?? []) if (!out[k].includes(v) && out[k].length < 8) out[k].push(v);
  }
  return empty(out) ? ({ phones: [], emails: [], sameAs: [] }) : out;
}
