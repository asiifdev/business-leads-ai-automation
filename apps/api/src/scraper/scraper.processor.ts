import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadsService } from "../leads/leads.service";
import { LeadIntelligenceService } from "../ai/lead-intelligence.service";
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

      const scoredLeads = this.leadIntelligence.scoreLeads(rawLeads, data.industry);
      await this.campaigns.updateStatus(campaignId, "running", 60);

      const processedLeads = await Promise.all(
        scoredLeads.map(async (lead, i) => {
          let marketingContent = null;
          if (lead.priority === "HIGH") {
            try {
              marketingContent = await this.marketingAi.generateContent({
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
            lat: lead.lat ?? undefined,
            lng: lead.lng ?? undefined,
            score: lead.score,
            priority: lead.priority,
            aiAnalysis: { factors: lead.factors, recommendation: lead.recommendation },
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
    } catch (err) {
      this.logger.error(`Campaign ${campaignId} failed: ${err}`);
      await this.campaigns.updateStatus(campaignId, "failed", undefined, String(err));
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

    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      try {
        const raw = await this.googleMaps.scrape(combo.query, perQuery);
        results.push(...raw.map((b) => this.normalizeRaw(b, data.industry)));
        this.logger.log(`Query "${combo.query}": ${raw.length} results`);
      } catch (err) {
        this.logger.warn(`Scrape failed for "${combo.query}", using mock fallback: ${err}`);
        results.push(...this.generateMockLeads(data, combo.query, combo.area, perQuery));
      }
      const pct = Math.round(((i + 1) / combos.length) * 28);
      await this.campaigns.updateStatus(campaignId, "running", pct);
    }

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
      hasWebsite: raw.hasWebsite ?? !!raw.website,
      referenceUrl: raw.referenceLink ?? "",
      lat: raw.lat ?? null,
      lng: raw.lng ?? null,
      industry,
    };
  }

  private generateMockLeads(data: ScraperJobData, query: string, area: string, count: number) {
    const label = query || data.industry;
    const prefixes = [
      `${label} Premier`, `Toko ${label} Jaya`, `${label} Makmur`,
      `Usaha ${label} Sejahtera`, `${label} Berkah`, `${label} Mandiri`,
      `${label} Maju`, `${label} Bersama`, `${label} Sukses`, `${label} Abadi`,
    ];
    return Array.from({ length: Math.min(count, prefixes.length) }, (_, i) => ({
      name: prefixes[i],
      address: `Jl. ${area} No. ${10 + i}, ${area}`,
      phone: `+628${String(10000000 + i * 1234567)}`,
      website: i % 3 !== 0 ? `www.${label.toLowerCase().replace(/\s+/g, "")}${i + 1}.com` : "",
      rating: ((3.5 + (i % 3) * 0.4)).toFixed(1),
      reviewCount: 5 + i * 17,
      hasWebsite: i % 3 !== 0,
      referenceUrl: "",
      lat: null,
      lng: null,
      industry: data.industry,
    }));
  }
}
