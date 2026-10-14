/** Where a business is: province, kabupaten/kota and kecamatan, read from an OpenStreetMap (Nominatim) reverse-geocode answer. */
export interface Region {
  province: string | null;
  regency: string | null;
  district: string | null;
}

export interface NominatimAddress {
  state?: string;
  province?: string;
  city?: string;
  county?: string;
  municipality?: string;
  town?: string;
  regency?: string;
  district?: string;
  city_district?: string;
  suburb?: string;
  country_code?: string;
}

const clean = (v: string | undefined) => v?.replace(/\s+/g, " ").trim().slice(0, 80) || null;

/** OSM names Jakarta's province in several ways; the list should show one. */
export function normalizeProvince(name: string | null): string | null {
  if (!name) return null;
  if (/jakarta/i.test(name)) return "DKI Jakarta";
  if (/yogyakarta/i.test(name)) return "DI Yogyakarta";
  return name.replace(/^provinsi\s+/i, "");
}

export function regionFromNominatim(a: NominatimAddress | undefined): Region | null {
  if (!a || (a.country_code && a.country_code.toLowerCase() !== "id")) return null;
  const isJakarta = [a.state, a.province, a.city].some((v) => v && /jakarta/i.test(v));
  const province = normalizeProvince(clean(a.state ?? a.province) ?? (isJakarta ? "DKI Jakarta" : null));
  // Jakarta has no kabupaten: its kota administrasi (Jakarta Timur...) comes as city_district and the kecamatan as suburb
  if (province === "DKI Jakarta") {
    const regency = clean(a.city_district ?? a.county ?? a.district);
    return { province, regency, district: clean(a.suburb ?? a.district) === regency ? null : clean(a.suburb ?? a.district) };
  }
  const regency = clean(a.city ?? a.county ?? a.regency ?? a.municipality ?? a.town);
  const district = clean(a.district ?? a.city_district);
  if (!province && !regency && !district) return null;
  return { province, regency, district };
}

/** About 550 m: leads this close share one lookup, so a few hundred leads need far fewer than a few hundred requests. */
export function cellKey(lat: number, lng: number): string {
  return `${(Math.round(lat / 0.005) * 0.005).toFixed(3)},${(Math.round(lng / 0.005) * 0.005).toFixed(3)}`;
}
