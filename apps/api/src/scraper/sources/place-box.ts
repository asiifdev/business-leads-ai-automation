import type { ConfigService } from "@nestjs/config";
import { bboxFromNominatim, type Bbox } from "./osm-overpass";

const DEFAULT_NOMINATIM = "https://nominatim.openstreetmap.org";

/**
 * The map box of a place name, from Nominatim (the public one allows one request a second; GEOCODER_URL can point at your own).
 * Shared by every source that searches by area. `country` (ISO code) keeps a name such as "Springfield" inside the campaign's country. Null when the place is not found; throws a message the operator can act on.
 */
export async function placeBox(place: string, config: ConfigService, fetchFn: typeof fetch = (input, init) => fetch(input, init), country?: string): Promise<Bbox | null> {
  const base = (config.get<string>("GEOCODER_URL") || DEFAULT_NOMINATIM).replace(/\/+$/, "");
  const res = await fetchFn(`${base}/search?format=jsonv2&limit=1&q=${encodeURIComponent(place.slice(0, 120))}${/^[A-Za-z]{2}$/.test(country ?? "") ? `&countrycodes=${country!.toLowerCase()}` : ""}`, {
    headers: { "User-Agent": config.get<string>("GEOCODER_USER_AGENT") || "Prospex/1.0 (self-hosted lead tool)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 429 || res.status === 403) throw new Error("the place lookup is rate-limited, try again in a minute");
  if (!res.ok) throw new Error(`the place lookup answered ${res.status}`);
  return bboxFromNominatim(await res.json());
}
