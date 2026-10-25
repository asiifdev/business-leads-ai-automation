import { Injectable, Logger } from "@nestjs/common";
import { planAreas, splitAreas, stripPlaces } from "../areas";
import { DEFAULT_COUNTRY } from "../../common/country";
import { GoogleMapsScraperService } from "../google-maps.scraper";
import { leadKey } from "../lead-key";
import type { LeadSource, RawSourceLead, SourceRequest } from "./lead-source";

/** Maps the raw browser error to something the operator can act on. */
export function explainScrapeError(message: string): string {
  if (/Executable doesn't exist|playwright install|browserType\.launch/i.test(message)) {
    return "The scraping browser is not installed on the server. Run: pnpm --filter @prospex/api exec playwright install chromium";
  }
  return `Google Maps scraping failed: ${message.split("\n")[0].slice(0, 200)}`;
}

/** Google Maps through a headless browser: one search per query and area. */
@Injectable()
export class GoogleMapsSource implements LeadSource {
  readonly id = "google_maps";
  private readonly logger = new Logger(GoogleMapsSource.name);

  constructor(private readonly maps: GoogleMapsScraperService) {}

  /**
   * Outside Indonesia a comma is as likely to be "Austin, Texas" as a list of cities, and no list of states can cover the
   * world. So when the text has a separator, Maps is asked first whether the whole text is one place; only if it is not
   * is it split. Indonesian campaigns split as always.
   */
  private async plan(req: SourceRequest) {
    const typed = req.location.trim();
    if (req.country !== DEFAULT_COUNTRY && process.env.SCRAPER_MODE !== "fixture" && splitAreas(typed).length > 1) {
      try {
        if (await this.maps.isSinglePlace(typed, req.country)) return { areas: [typed], perSearch: Math.max(1, Math.ceil(req.maxResults / Math.max(1, req.searchQueries.length))), nationwide: false };
      } catch (e) {
        this.logger.warn(`Could not check whether "${typed}" is one place, splitting it: ${(e as Error).message}`);
      }
    }
    return planAreas(typed, req.searchQueries.length, req.maxResults);
  }

  async search(req: SourceRequest): Promise<RawSourceLead[]> {
    // "Seluruh Indonesia" becomes one search per city: Google ranks a country-wide search by where the searcher is.
    const plan = await this.plan(req);
    // City by city across all queries, so a stop part-way still covers the biggest markets for every query.
    const combos = plan.areas.flatMap((area) => req.searchQueries.map((query) => ({ query: `${stripPlaces(query, plan.areas)} ${area}`.trim(), area })));
    const perQuery = plan.perSearch;
    if (plan.nationwide) this.logger.log(`Nationwide campaign: ${plan.areas.length} cities x ${req.searchQueries.length} queries, ${perQuery} results each`);
    const results: RawSourceLead[] = [];
    const errors: string[] = [];
    const fixtures = process.env.SCRAPER_MODE === "fixture";

    const unique = new Set<string>();
    const countNew = (list: { name: string; address: string; phone: string }[]) => {
      for (const b of list) unique.add(leadKey(b));
      return unique.size;
    };

    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      if (!fixtures && countNew(results) >= req.maxResults) {
        this.logger.log(`Target of ${req.maxResults} reached after ${i} of ${combos.length} searches`);
        break;
      }
      if (fixtures) {
        results.push(...this.fixtureLeads(req, combo.query, combo.area, perQuery));
      } else {
        try {
          const raw = await this.maps.scrape(combo.query, perQuery, { area: combo.area, country: req.country });
          results.push(...raw.map((b) => this.normalize(b, req.industry)));
          this.logger.log(`Query "${combo.query}": ${raw.length} results`);
          // A short random pause between searches: hundreds of searches in a row from one address look like a robot.
          if (plan.nationwide && i < combos.length - 1) await new Promise((r) => setTimeout(r, 2500 + Math.random() * 3500));
        } catch (err) {
          // A failed search is reported, never replaced with invented businesses.
          this.logger.warn(`Scrape failed for "${combo.query}": ${err}`);
          errors.push(String((err as Error).message ?? err));
        }
      }
      await req.onProgress?.(Math.round(((i + 1) / combos.length) * 100));
    }

    if (results.length === 0 && errors.length > 0) throw new Error(explainScrapeError(errors[0]));

    // Deduplicate: the same listing can come up under several cities and queries.
    const seen = new Set<string>();
    return results.filter((b) => {
      const key = leadKey(b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private normalize(
    raw: {
      name: string;
      address: string;
      phone: string;
      website: string;
      rating: string;
      reviewCount?: number | null;
      category?: string;
      hasWebsite: boolean;
      referenceLink?: string;
      lat?: number | null;
      lng?: number | null;
      businessStatus?: string | null;
    },
    industry: string,
  ): RawSourceLead {
    return {
      name: raw.name,
      address: raw.address,
      phone: raw.phone ?? "",
      website: raw.website ?? "",
      rating: raw.rating ?? "N/A",
      reviewCount: raw.reviewCount ?? null,
      category: raw.category ?? "",
      hasWebsite: raw.hasWebsite ?? !!raw.website,
      referenceUrl: raw.referenceLink ?? "",
      lat: raw.lat ?? null,
      lng: raw.lng ?? null,
      businessStatus: raw.businessStatus === "permanently_closed" || raw.businessStatus === "temporarily_closed" ? raw.businessStatus : null,
      industry,
      source: "google_maps",
    };
  }

  /**
   * Only for tests and demos (SCRAPER_MODE=fixture). Clearly labelled, with no phone number, no website and
   * source "fixture", so they can never be mistaken for real businesses or be contacted.
   */
  private fixtureLeads(req: SourceRequest, query: string, area: string, count: number): RawSourceLead[] {
    return Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      name: `[Test data] ${query} ${i + 1}`,
      address: `${area}`,
      phone: "",
      website: "",
      rating: (3.5 + (i % 3) * 0.4).toFixed(1),
      reviewCount: 5 + i * 17,
      category: "",
      hasWebsite: false,
      referenceUrl: "",
      lat: null,
      lng: null,
      businessStatus: null,
      industry: req.industry,
      source: "fixture",
    }));
  }
}
