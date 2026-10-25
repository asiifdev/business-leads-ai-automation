/**
 * Turns what a person types as a search ("toko kamera", "restoran", "shop=camera") into OpenStreetMap tags.
 * OpenStreetMap has no free-text search for business types, only tags such as shop=camera, in English. So: a tag typed as
 * key=value is used as it is, and a few dozen common business types are known by their Indonesian and English names. A type that
 * is not in the list is looked for as part of a business name instead (slower: Overpass has to read every name), or by typing its tag.
 */
export interface OsmFilter {
  /** An exact tag, e.g. shop=camera. */
  tag?: [key: string, value: string];
  /** A phrase to find in the business name (letters, digits and spaces only). */
  name?: string;
}

/** Common business types by their Indonesian and English names. `tags` are OpenStreetMap tags; `overture` are pieces of Overture Maps category names. */
export const BUSINESS_TYPES: { words: string[]; tags: [string, string][]; overture?: string[] }[] = [
  { words: ["restoran", "restaurant", "rumah makan", "warung makan"], tags: [["amenity", "restaurant"]], overture: ["restaurant"] },
  { words: ["cafe", "kafe", "kedai kopi", "coffee shop"], tags: [["amenity", "cafe"]], overture: ["cafe","coffee_shop"] },
  { words: ["toko roti", "bakery", "bakeri"], tags: [["shop", "bakery"]], overture: ["bakery"] },
  { words: ["bengkel mobil", "car repair", "bengkel"], tags: [["shop", "car_repair"]], overture: ["automotive_repair","auto_repair"] },
  { words: ["bengkel motor", "motorcycle repair"], tags: [["shop", "motorcycle_repair"]], overture: ["motorcycle_repair"] },
  { words: ["salon", "hair salon", "barbershop", "barber"], tags: [["shop", "hairdresser"]], overture: ["hair_salon","barber"] },
  { words: ["kecantikan", "beauty", "klinik kecantikan"], tags: [["shop", "beauty"]], overture: ["beauty_salon","beauty"] },
  { words: ["apotek", "pharmacy", "toko obat"], tags: [["amenity", "pharmacy"]], overture: ["pharmacy"] },
  { words: ["klinik", "clinic"], tags: [["amenity", "clinic"]], overture: ["clinic","doctors_office"] },
  { words: ["dokter gigi", "klinik gigi", "dentist"], tags: [["amenity", "dentist"]], overture: ["dental","dentist"] },
  { words: ["rumah sakit", "hospital"], tags: [["amenity", "hospital"]], overture: ["hospital"] },
  { words: ["dokter hewan", "veterinary", "klinik hewan"], tags: [["amenity", "veterinary"]], overture: ["veterinar"] },
  { words: ["sekolah", "school"], tags: [["amenity", "school"]], overture: ["school"] },
  { words: ["bimbel", "kursus", "bimbingan belajar", "tutoring"], tags: [["amenity", "prep_school"], ["amenity", "language_school"]], overture: ["tutor","language_school"] },
  { words: ["sekolah mengemudi", "kursus mengemudi", "driving school"], tags: [["amenity", "driving_school"]], overture: ["driving_school"] },
  { words: ["hotel", "penginapan"], tags: [["tourism", "hotel"], ["tourism", "guest_house"]], overture: ["hotel","lodging"] },
  { words: ["homestay", "guest house", "wisma"], tags: [["tourism", "guest_house"]], overture: ["guest_house","bed_and_breakfast","holiday_rental"] },
  { words: ["toko kamera", "camera shop", "kamera"], tags: [["shop", "camera"]], overture: ["camera"] },
  { words: ["toko elektronik", "electronics"], tags: [["shop", "electronics"]], overture: ["electronics_store"] },
  { words: ["toko handphone", "toko hp", "mobile phone", "konter"], tags: [["shop", "mobile_phone"]], overture: ["mobile_phone"] },
  { words: ["toko komputer", "computer shop", "toko laptop"], tags: [["shop", "computer"]], overture: ["computer_store"] },
  { words: ["toko baju", "toko pakaian", "butik", "boutique", "clothes", "fashion"], tags: [["shop", "clothes"], ["shop", "boutique"]], overture: ["clothing_store","fashion"] },
  { words: ["toko sepatu", "shoe shop"], tags: [["shop", "shoes"]], overture: ["shoe_store"] },
  { words: ["toko buku", "book store", "bookshop"], tags: [["shop", "books"]], overture: ["bookstore"] },
  { words: ["toko bangunan", "material bangunan", "hardware"], tags: [["shop", "hardware"], ["shop", "doityourself"]], overture: ["building_supply","hardware_store"] },
  { words: ["supermarket", "swalayan"], tags: [["shop", "supermarket"]], overture: ["supermarket","grocery_store"] },
  { words: ["minimarket", "toko kelontong", "convenience", "warung"], tags: [["shop", "convenience"]], overture: ["convenience_store"] },
  { words: ["toko bunga", "florist", "florist"], tags: [["shop", "florist"]], overture: ["flowers_and_gifts","florist"] },
  { words: ["laundry", "binatu"], tags: [["shop", "laundry"]], overture: ["laundromat","laundry","dry_clean"] },
  { words: ["percetakan", "digital printing", "fotokopi", "print shop"], tags: [["shop", "copyshop"], ["craft", "printer"]], overture: ["printing_service","print_shop"] },
  { words: ["fotografer", "studio foto", "photographer", "photo studio"], tags: [["craft", "photographer"], ["shop", "photo"]], overture: ["photograph"] },
  { words: ["gym", "fitness", "pusat kebugaran"], tags: [["leisure", "fitness_centre"]], overture: ["gym","fitness"] },
  { words: ["spa", "pijat", "massage"], tags: [["shop", "massage"], ["leisure", "spa"]], overture: ["spa","massage"] },
  { words: ["biro perjalanan", "travel agent", "travel agency", "agen travel"], tags: [["shop", "travel_agency"]], overture: ["travel_agency","travel_service","tour_operator"] },
  { words: ["pengacara", "lawyer", "advokat"], tags: [["office", "lawyer"]], overture: ["lawyer","attorney"] },
  { words: ["notaris", "notary"], tags: [["office", "notary"]], overture: ["notary"] },
  { words: ["akuntan", "accountant", "konsultan pajak"], tags: [["office", "accountant"]], overture: ["accountant","accounting"] },
  { words: ["kantor asuransi", "asuransi", "insurance"], tags: [["office", "insurance"]], overture: ["insurance"] },
  { words: ["agen properti", "real estate", "properti"], tags: [["office", "estate_agent"]], overture: ["real_estate"] },
  { words: ["rental mobil", "car rental", "sewa mobil"], tags: [["amenity", "car_rental"]], overture: ["car_rental"] },
  { words: ["dealer mobil", "showroom mobil", "car dealer"], tags: [["shop", "car"]], overture: ["auto_dealer","car_dealer"] },
  { words: ["dealer motor", "motorcycle dealer"], tags: [["shop", "motorcycle"]], overture: ["motorcycle_dealer"] },
  { words: ["toko furnitur", "furniture", "mebel"], tags: [["shop", "furniture"]], overture: ["furniture"] },
  { words: ["optik", "optician", "kacamata"], tags: [["shop", "optician"]], overture: ["eyewear","optical"] },
  { words: ["pet shop", "petshop", "toko hewan"], tags: [["shop", "pet"]], overture: ["pet_store"] },
  { words: ["bank"], tags: [["amenity", "bank"]], overture: ["bank_or_credit_union"] },
  { words: ["penjahit", "tailor", "konveksi"], tags: [["craft", "tailor"], ["shop", "tailor"]], overture: ["tailor","sewing"] },
  { words: ["toko mainan", "toy store"], tags: [["shop", "toys"]], overture: ["toy_store"] },
  { words: ["toko sembako", "grosir", "wholesale"], tags: [["shop", "wholesale"], ["shop", "convenience"]], overture: ["wholesale","grocery_store"] },
  { words: ["toko olahraga", "sports shop"], tags: [["shop", "sports"]], overture: ["sporting_goods"] },
  { words: ["toko perhiasan", "jewelry", "toko emas"], tags: [["shop", "jewelry"]], overture: ["jewelry"] },
  { words: ["pasar", "market"], tags: [["amenity", "marketplace"]] },
  { words: ["toko cat", "paint"], tags: [["shop", "paint"]], overture: ["paint"] },
  { words: ["tukang kayu", "carpenter"], tags: [["craft", "carpenter"]], overture: ["carpenter"] },
  { words: ["toko alat tulis", "stationery", "atk"], tags: [["shop", "stationery"]], overture: ["stationery"] },
];

export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9=_:; ]+/g, " ").replace(/\s+/g, " ").trim();
export const wordIn = (needle: string, hay: string) => new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(hay);

/** Keeps only letters, digits, spaces and a few harmless marks, so a phrase can sit inside an Overpass string. */
export function safePhrase(s: string): string {
  return s.normalize("NFKD").replace(/[^A-Za-z0-9 '&-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

const TAG = /^([a-z_]{2,30}):?([a-z_]{0,30})=([a-z0-9_]{1,60})$/;

/** The filters for one search term. A term typed as key=value is exactly that tag; anything else is matched by type and by name. */
export function parseOsmQuery(query: string): OsmFilter[] {
  const raw = query.trim().toLowerCase();
  const direct = raw.replace(/\s+/g, "").match(TAG);
  if (direct) return [{ tag: [direct[2] ? `${direct[1]}:${direct[2]}` : direct[1], direct[3]] }];
  const n = normalize(query);
  const out: OsmFilter[] = [];
  const seen = new Set<string>();
  for (const t of BUSINESS_TYPES) {
    if (!t.words.some((w) => wordIn(w, n))) continue;
    for (const [k, v] of t.tags) {
      if (!seen.has(`${k}=${v}`)) { seen.add(`${k}=${v}`); out.push({ tag: [k, v] }); }
    }
  }
  // Reading every name in the box is the expensive part of a query, so it is only done for a type that has no tag.
  if (!out.length) {
    const phrase = safePhrase(query);
    if (phrase.length >= 3) out.push({ name: phrase });
  }
  return out;
}
