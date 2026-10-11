import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadsService } from "../leads/leads.service";
import { LeadIntelligenceService } from "../ai/lead-intelligence.service";
import { EnrichmentService } from "../leads/enrichment.service";
import { FitService } from "../ai/fit.service";
import { MarketingAiService } from "../ai/marketing-ai.service";
import { GoogleMapsScraperService } from "./google-maps.scraper";

export interface ScraperJobData {
  campaignId: string;
  workspaceId: string;
  searchQueries: string[];
  industry: string;
  location: string;
  maxResults: number;
  yourService: string;
  contentStyle: string;
  language: string;
}

@Processor("scraper")
@Injectable()
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private campaigns: CampaignsService,
    private leads: LeadsService,
    private leadIntelligence: LeadIntelligenceService,
    private marketingAi: MarketingAiService,
    private googleMaps: GoogleMapsScraperService,
    private fit: FitService,
    private enrichment: EnrichmentService,
  ) {
    super();
  }

  async process(job: Job<ScraperJobData>): Promise<void> {
    const data = job.data;
    const { campaignId, workspaceId } = data;
    this.logger.log(`Starting campaign ${campaignId} (job ${job.id})`);

    try {
      await this.campaigns.updateStatus(campaignId, "running", 0);

      const rawLeads = await this.scrapeLeads(data, campaignId);
      const total = rawLeads.length;

      if (total === 0) {
        await this.campaigns.updateStatus(campaignId, "failed", 0, "No leads found");
        return;
      }

      await this.campaigns.updateStatus(campaignId, "running", 30);

      // Fit is judged per business from its name and real Google Maps category, against the offer and the Marketing Brief (needs an AI provider).
      const fits = await this.fit.assess(workspaceId, rawLeads.map((l) => ({ name: l.name, category: l.category })), data.yourService, data.language === "english" ? "english" : "indonesian");
      const scoredLeads = this.leadIntelligence.scoreLeads(rawLeads, fits);
      await this.campaigns.updateStatus(campaignId, "running", 60);

      const processedLeads = await Promise.all(
        scoredLeads.map(async (lead, i) => {
          let marketingContent = null;
          if (lead.priority === "HIGH") {
            try {
              marketingContent = await this.marketingAi.generateContent(workspaceId, {
                businessName: lead.name,
                address: lead.address,
                industry: data.industry,
                rating: lead.rating,
                hasWebsite: lead.hasWebsite,
                yourService: data.yourService,
                contentStyle: data.contentStyle,
                language: data.language,
                score: lead.score,
              });
            } catch (e) {
              this.logger.warn(`Content gen failed for ${lead.name}: ${e}`);
            }
          }
          if (i % 5 === 0) {
            const pct = 60 + Math.round((i / total) * 35);
            await this.campaigns.updateStatus(campaignId, "running", pct);
          }
          return {
            name: lead.name,
            address: lead.address,
            phone: lead.phone,
            website: lead.website,
            rating: lead.rating,
            reviewCount: lead.reviewCount ?? undefined,
            hasWebsite: lead.hasWebsite ?? false,
            referenceUrl: lead.referenceUrl,
            source: (lead as { source?: string }).source ?? "google_maps",
            lat: lead.lat ?? undefined,
            lng: lead.lng ?? undefined,
            score: lead.score,
            priority: lead.priority,
            category: (lead as { category?: string }).category || undefined,
            aiAnalysis: { factors: lead.factors, recommendation: lead.recommendation, ...(lead.fit ? { fit: lead.fit } : {}) },
            marketingContent,
            campaignId,
            workspaceId,
          };
        }),
      );

      await this.leads.createMany(processedLeads);

      const highQuality = processedLeads.filter((l) => (l.score ?? 0) >= 70).length;
      const priority = processedLeads.filter((l) => l.priority === "HIGH").length;
      const avgScore = Math.round(
        processedLeads.reduce((s, l) => s + (l.score ?? 0), 0) / processedLeads.length,
      );

      await this.campaigns.updateStats(campaignId, {
        totalLeads: total,
        priorityLeads: priority,
        highQualityLeads: highQuality,
        averageScore: avgScore,
      });

      await this.campaigns.updateStatus(campaignId, "completed", 100);
      this.logger.log(`Campaign ${campaignId} done: ${total} leads, ${priority} priority`);

      // Contact details from each business's own website. Runs after the campaign is complete and never fails it.
      if (process.env.SCRAPER_MODE !== "fixture") {
        void this.enrichment.enrichCampaign(workspaceId, campaignId)
          .then((r) => this.logger.log(`Campaign ${campaignId} enrichment: ${JSON.stringify(r)}`))
          .catch((e) => this.logger.warn(`Campaign ${campaignId} enrichment failed: ${e}`));
      }
    } catch (err) {
      this.logger.error(`Campaign ${campaignId} failed: ${err}`);
      await this.campaigns.updateStatus(campaignId, "failed", undefined, (err as Error).message ?? String(err));
      throw err; // re-throw so BullMQ can retry if configured
    }
  }

  private async scrapeLeads(data: ScraperJobData, campaignId: string) {
    const areas = data.location
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (areas.length === 0) areas.push(data.location);

    const combos = data.searchQueries.flatMap((query) =>
      areas.map((area) => ({ query: `${query} ${area}`.trim(), area })),
    );
    const perQuery = Math.ceil(data.maxResults / combos.length);
    const results: ReturnType<typeof this.normalizeRaw>[] = [];
    const errors: string[] = [];
    const fixtures = process.env.SCRAPER_MODE === "fixture";

    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      if (fixtures) {
        results.push(...this.fixtureLeads(data, combo.query, combo.area, perQuery));
      } else {
        try {
          const raw = await this.googleMaps.scrape(combo.query, perQuery);
          results.push(...raw.map((b) => this.normalizeRaw(b, data.industry)));
          this.logger.log(`Query "${combo.query}": ${raw.length} results`);
        } catch (err) {
          // A failed search is reported, never replaced with invented businesses.
          this.logger.warn(`Scrape failed for "${combo.query}": ${err}`);
          errors.push(String((err as Error).message ?? err));
        }
      }
      const pct = Math.round(((i + 1) / combos.length) * 28);
      await this.campaigns.updateStatus(campaignId, "running", pct);
    }

    if (results.length === 0 && errors.length > 0) throw new Error(this.explainScrapeError(errors[0]));

    // Deduplicate by name+address
    const seen = new Set<string>();
    return results.filter((b) => {
      const key = `${b.name.toLowerCase()}|${b.address.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private normalizeRaw(
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
    },
    industry: string,
  ) {
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
      industry,
      source: "google_maps",
    };
  }

  /** Maps the raw browser error to something the operator can act on. */
  private explainScrapeError(message: string): string {
    if (/Executable doesn't exist|playwright install|browserType\.launch/i.test(message)) {
      return "The scraping browser is not installed on the server. Run: pnpm --filter @prospex/api exec playwright install chromium";
    }
    return `Google Maps scraping failed: ${message.split("\n")[0].slice(0, 200)}`;
  }

  /**
   * Only for tests and demos (SCRAPER_MODE=fixture). Clearly labelled, with no phone number, no website and
   * source "fixture", so they can never be mistaken for real businesses or be contacted.
   */
  private fixtureLeads(data: ScraperJobData, query: string, area: string, count: number) {
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
      industry: data.industry,
      source: "fixture",
    }));
  }
}
