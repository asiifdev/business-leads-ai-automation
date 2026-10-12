/**
 * Which places to search. Google Maps ranks a country-wide search ("sewa kamera Indonesia") by the searcher's own
 * location, so it returns the searcher's neighbourhood and nothing else. A nationwide campaign is therefore turned into
 * one search per city, from the biggest markets down.
 */

/** Roughly by market size. Real cities and regencies; the order decides which ones a smaller campaign uses. */
export const INDONESIA_CITIES = [
  "Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Tangerang", "Depok", "Bekasi",
  "Bogor", "Yogyakarta", "Malang", "Denpasar", "Batam", "Pekanbaru", "Bandar Lampung", "Padang", "Balikpapan", "Samarinda",
  "Banjarmasin", "Pontianak", "Surakarta", "Manado", "Cirebon", "Jambi", "Sidoarjo", "Serang", "Mataram", "Kediri",
  "Jember", "Purwokerto", "Tasikmalaya", "Sukabumi", "Cilegon", "Karawang", "Magelang", "Pekalongan", "Tegal", "Kudus",
  "Banyuwangi", "Madiun", "Probolinggo", "Pasuruan", "Mojokerto", "Blitar", "Salatiga", "Gresik", "Lampung", "Palu",
  "Kendari", "Ambon", "Jayapura", "Kupang", "Bengkulu", "Pangkalpinang", "Tanjungpinang", "Banda Aceh", "Lhokseumawe", "Pematangsiantar",
  "Binjai", "Padang Panjang", "Bukittinggi", "Dumai", "Palangkaraya", "Tarakan", "Singaraja", "Gianyar", "Klaten", "Sleman",
] as const;

/** Other ways people write the same place. Used to recognise a place name inside a search phrase. */
const PLACE_ALIASES = ["Jogja", "Jogjakarta", "Yogya", "DIY", "Solo", "Bali", "Jabodetabek", "Jabar", "Jateng", "Jatim", "Sumatera", "Jawa", "Kalimantan", "Sulawesi", "Papua", "Indonesia"];

const NATIONWIDE = /^(seluruh|semua|se)\s*indonesia$|^indonesia$|^nasional$|^all\s+indonesia$|^whole\s+indonesia$|^nationwide$/i;

export function isNationwide(location: string): boolean {
  return NATIONWIDE.test(location.trim());
}

/** Searches an average rental query returns that carry a phone number: a deliberately cautious guess, used only to size the plan. */
const USABLE_PER_SEARCH = 40; // a big city gives well over 40 per search; 12 was far too timid
const MAX_PER_SEARCH = 100; // Google Maps itself stops listing at roughly 120
const SAFETY = 1.6; // duplicates and listings without a number

export interface AreaPlan {
  areas: string[];
  /** How many results to ask each search for. */
  perSearch: number;
  nationwide: boolean;
}

/**
 * A comma-separated list stays as typed. "Seluruh Indonesia" becomes enough cities to reach `maxResults` with room for
 * duplicates, never fewer than 8 and never more than the list holds.
 */
export function planAreas(location: string, queryCount: number, maxResults: number): AreaPlan {
  const typed = splitAreas(location);
  if (!isNationwide(location)) {
    const areas = typed.length ? typed : [location.trim()];
    return { areas, perSearch: Math.max(1, Math.ceil(maxResults / Math.max(1, queryCount * areas.length))), nationwide: false };
  }
  const q = Math.max(1, queryCount);
  const wanted = Math.ceil((maxResults * SAFETY) / (q * USABLE_PER_SEARCH));
  const count = Math.min(INDONESIA_CITIES.length, Math.max(8, wanted));
  const areas = INDONESIA_CITIES.slice(0, count) as unknown as string[];
  const perSearch = Math.min(MAX_PER_SEARCH, Math.max(USABLE_PER_SEARCH, Math.ceil((maxResults * SAFETY) / (q * count))));
  return { areas, perSearch, nationwide: true };
}


/**
 * Splits what a person typed into separate places. Commas are the documented separator, but people also write
 * "yogyakarta, medan dan semarang", "Solo & Jogja", "Medan; Batam" or one city per line. Treating those as one long
 * place name made Google search only the first city, near the searcher.
 */
export function splitAreas(location: string): string[] {
  const parts = location
    .split(/[,;\n\r|\/+]|\s&\s|\s+(?:dan|and|serta|atau|plus)\s+/i)
    .map((a) => {
      let x = a.trim();
      for (let i = 0; i < 3; i++) x = x.replace(/^(di|in|kota|kab\.?|kabupaten)\s+/i, "").trim();
      return x;
    })
    .filter((a) => a.length > 1);
  const seen = new Set<string>();
  return parts.filter((a) => (seen.has(a.toLowerCase()) ? false : (seen.add(a.toLowerCase()), true)));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Removes place names from a search phrase so the campaign's areas decide where to look. A query like "sewa kamera Solo"
 * searched together with area "Medan" would otherwise become "sewa kamera Solo Medan", which Google answers near Solo.
 */
export function stripPlaces(query: string, typedAreas: string[] = []): string {
  const places = [...INDONESIA_CITIES, ...PLACE_ALIASES, ...typedAreas].map((p) => p.trim()).filter((p) => p.length > 1).sort((a, b) => b.length - a.length);
  let out = query;
  for (const p of places) out = out.replace(new RegExp(`(^|\\s)(?:di\\s+)?${escapeRe(p)}(?=\\s|$)`, "gi"), " ");
  out = out.replace(/\s+(di|in|se)$/i, "").replace(/\s+/g, " ").trim();
  return out.length >= 3 ? out : query.trim(); // never end up with an empty search
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** How far from the searched place a result may be and still count as "in" it. A city and its suburbs, not the next province. */
export const DEFAULT_RADIUS_KM = 50;

/**
 * Keeps the results that really are in the searched area. Google ranks by relevance and by where the searcher is, so a
 * search for one city can still list shops from elsewhere; distance from the city's centre is the check that cannot be
 * fooled. A result with no coordinates is kept only if its address names the area.
 */
export function inArea<T extends { lat: number | null; lng: number | null; address: string }>(results: T[], area: string, center: LatLng, radiusKm = DEFAULT_RADIUS_KM): { kept: T[]; dropped: number } {
  const name = area.toLowerCase();
  const kept = results.filter((b) => {
    if (b.lat != null && b.lng != null) return haversineKm(center, { lat: b.lat, lng: b.lng }) <= radiusKm;
    return (b.address ?? "").toLowerCase().includes(name);
  });
  return { kept, dropped: results.length - kept.length };
}
