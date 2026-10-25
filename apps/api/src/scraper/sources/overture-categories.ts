import { BUSINESS_TYPES, normalize, safePhrase, wordIn } from "./osm-tags";

/**
 * What to look for in Overture Maps for one search term. `stems` are pieces of Overture's English category names ("restaurant"
 * also matches indonesian_restaurant); `name` is a phrase to find in business names, used only when the term is not a known
 * business type. A term typed as `category=camera_store` is used as a category piece exactly.
 */
export interface OvertureFilter {
  stems: string[];
  name?: string;
}

const STEM = /^[a-z][a-z_]{1,50}$/;

export function parseOvertureQuery(query: string): OvertureFilter {
  const direct = /^\s*category\s*=\s*([a-z_]{2,50})\s*$/i.exec(query);
  if (direct) return { stems: [direct[1].toLowerCase()] };
  const n = normalize(query);
  const stems: string[] = [];
  for (const t of BUSINESS_TYPES) {
    if (!t.overture || !t.words.some((w) => wordIn(w, n))) continue;
    for (const s of t.overture) if (!stems.includes(s)) stems.push(s);
  }
  if (stems.length) return { stems };
  const phrase = safePhrase(query);
  return phrase.length >= 3 ? { stems: [], name: phrase } : { stems: [] };
}

/** All search terms of a campaign as one filter: category pieces and name phrases, each once. Only safe tokens are returned. */
export function overtureFilters(queries: string[]): { stems: string[]; names: string[] } {
  const stems = new Set<string>();
  const names = new Set<string>();
  for (const q of queries) {
    const f = parseOvertureQuery(q);
    for (const s of f.stems) if (STEM.test(s)) stems.add(s);
    if (f.name) names.add(f.name);
  }
  return { stems: [...stems].slice(0, 40), names: [...names].slice(0, 10) };
}
