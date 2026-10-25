/**
 * One way of finding businesses. Every source returns the same shape, so scoring, de-duplication, enrichment and the
 * data-quality rules do not care where a lead came from. A source never invents a business: when it finds nothing it
 * returns nothing, and when it cannot run it throws.
 */
export interface RawSourceLead {
  name: string;
  address: string;
  phone: string;
  website: string;
  email?: string;
  rating: string;
  reviewCount: number | null;
  category: string;
  hasWebsite: boolean;
  referenceUrl: string;
  lat: number | null;
  lng: number | null;
  businessStatus: "permanently_closed" | "temporarily_closed" | null;
  /** Public profile pages the source itself lists for the business (instagram, facebook), as full URLs. */
  social?: Partial<Record<"instagram" | "facebook", string>>;
  industry?: string;
  /** google_maps | osm | csv_import | fixture */
  source: string;
  /** Fields that came from a different source than `source` (filled in when the same business was found twice). */
  fieldSources?: Record<string, string>;
}

export interface SourceRequest {
  searchQueries: string[];
  location: string;
  /** ISO 3166-1 alpha-2 code of the country the location is in. */
  country: string;
  industry: string;
  /** How many more leads are wanted from this source. */
  maxResults: number;
  /** Called with 0..100 as the source works through its searches. */
  onProgress?: (pct: number) => void | Promise<void>;
}

export interface LeadSource {
  readonly id: string;
  /** Throws when the source cannot run (not installed, switched off, unreachable), with a message the operator can act on. */
  search(req: SourceRequest): Promise<RawSourceLead[]>;
}
