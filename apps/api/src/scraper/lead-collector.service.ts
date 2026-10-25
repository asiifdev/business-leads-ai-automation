import { Injectable, Logger } from "@nestjs/common";
import { GoogleMapsSource } from "./sources/google-maps.source";
import { OsmSource } from "./sources/osm.source";
import { OvertureSource } from "./sources/overture.source";
import { mergeSourceLeads } from "./sources/merge";
import type { LeadSource, RawSourceLead, SourceRequest } from "./sources/lead-source";

export interface CollectRequest extends Omit<SourceRequest, "onProgress"> {
  /** Source ids in the order they are tried. */
  sources: string[];
  onProgress?: (pct: number) => void | Promise<void>;
}

export interface CollectResult {
  leads: RawSourceLead[];
  /** How many each source returned before the same business found twice was merged. */
  perSource: Record<string, number>;
  /** Sources that failed while others still produced leads. */
  warnings: string[];
}

/**
 * Runs the campaign's sources one after another and merges what they find. Each later source is asked only for what the earlier
 * ones left of `maxResults`. A source that fails is reported as a warning as long as another produced leads; if nothing was found
 * anywhere the failure is thrown, so a campaign never "succeeds" with invented or empty data.
 */
@Injectable()
export class LeadCollectorService {
  private readonly logger = new Logger(LeadCollectorService.name);
  private readonly byId = new Map<string, LeadSource>();

  constructor(maps: GoogleMapsSource, osm?: OsmSource, overture?: OvertureSource) {
    this.register(maps);
    if (osm) this.register(osm);
    if (overture) this.register(overture);
  }

  register(source: LeadSource) {
    this.byId.set(source.id, source);
  }

  async collect(req: CollectRequest): Promise<CollectResult> {
    // Test data comes from the Maps source's own fixture mode; no other source may add to it.
    const ids = process.env.SCRAPER_MODE === "fixture" ? ["google_maps"] : [...new Set(req.sources.length ? req.sources : ["google_maps"])];
    let leads: RawSourceLead[] = [];
    const perSource: Record<string, number> = {};
    const failures: { id: string; message: string }[] = [];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const source = this.byId.get(id);
      if (!source) { failures.push({ id, message: "this source is not available" }); continue; }
      const remaining = req.maxResults - leads.length;
      if (remaining <= 0) break;
      try {
        const found = await source.search({
          searchQueries: req.searchQueries,
          location: req.location,
          country: req.country,
          industry: req.industry,
          maxResults: remaining,
          onProgress: (pct) => req.onProgress?.(Math.round(((i + pct / 100) / ids.length) * 100)),
        });
        perSource[id] = found.length;
        leads = mergeSourceLeads(leads, found).leads;
        this.logger.log(`Source ${id}: ${found.length} found, ${leads.length} in total`);
      } catch (e) {
        const message = String((e as Error).message ?? e);
        this.logger.warn(`Source ${id} failed: ${message}`);
        failures.push({ id, message });
      }
    }

    if (leads.length === 0 && failures.length > 0) {
      throw new Error(failures.length === 1 ? failures[0].message : failures.map((f) => `${f.id}: ${f.message}`).join(" | "));
    }
    return { leads, perSource, warnings: failures.map((f) => `${f.id}: ${f.message}`) };
  }
}
