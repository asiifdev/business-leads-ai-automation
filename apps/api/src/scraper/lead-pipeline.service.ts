import { Injectable, Logger } from "@nestjs/common";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadsService } from "../leads/leads.service";
import { LeadIntelligenceService } from "../ai/lead-intelligence.service";
import { GeoService } from "../leads/geo.service";
import { EnrichmentService } from "../leads/enrichment.service";
import { FitService } from "../ai/fit.service";
import { MarketingAiService } from "../ai/marketing-ai.service";
import type { RawSourceLead } from "./sources/lead-source";

export interface PipelineJob {
  campaignId: string;
  workspaceId: string;
  industry: string;
  yourService: string;
  contentStyle: string;
  language: string;
}

/**
 * What happens to leads once they are found, wherever they came from (a scrape, OpenStreetMap, an imported file): fit judgement,
 * score, notes for the best ones, saving with the data-trust marks, the campaign's totals, areas and contact enrichment.
 */
@Injectable()
export class LeadPipelineService {
  private readonly logger = new Logger(LeadPipelineService.name);

  constructor(
    private campaigns: CampaignsService,
    private leads: LeadsService,
    private leadIntelligence: LeadIntelligenceService,
    private marketingAi: MarketingAiService,
    private fit: FitService,
    private enrichment: EnrichmentService,
    private geo: GeoService,
  ) {}

  /** `from` is the progress already reached (0..100) when the leads arrive. Marks the campaign completed, with `note` as its message. */
  async ingest(job: PipelineJob, raw: RawSourceLead[], opts: { from?: number; note?: string } = {}): Promise<{ saved: number }> {
    const { campaignId, workspaceId } = job;
    const from = opts.from ?? 30;
    const total = raw.length;
    await this.campaigns.updateStatus(campaignId, "running", from);

    // Fit is judged per business from its name and real category, against the offer and the Marketing Brief (needs an AI provider).
    const fits = await this.fit.assess(workspaceId, raw.map((l) => ({ name: l.name, category: l.category })), job.yourService, job.language === "english" ? "english" : "indonesian");
    const scored = this.leadIntelligence.scoreLeads(raw, fits);
    await this.campaigns.updateStatus(campaignId, "running", Math.max(from, 60));

    const processed = await Promise.all(
      scored.map(async (lead, i) => {
        let marketingContent = null;
        if (lead.priority === "HIGH") {
          try {
            marketingContent = await this.marketingAi.generateContent(workspaceId, {
              businessName: lead.name,
              address: lead.address,
              industry: job.industry,
              rating: lead.rating,
              hasWebsite: lead.hasWebsite,
              yourService: job.yourService,
              contentStyle: job.contentStyle,
              language: job.language,
              score: lead.score,
            });
          } catch (e) {
            this.logger.warn(`Content gen failed for ${lead.name}: ${e}`);
          }
        }
        if (i % 5 === 0) await this.campaigns.updateStatus(campaignId, "running", 60 + Math.round((i / Math.max(total, 1)) * 35));
        return {
          name: lead.name,
          address: lead.address,
          phone: lead.phone,
          website: lead.website,
          email: lead.email || undefined,
          rating: lead.rating,
          reviewCount: lead.reviewCount ?? undefined,
          hasWebsite: lead.hasWebsite ?? false,
          referenceUrl: lead.referenceUrl,
          source: lead.source,
          fieldSources: lead.fieldSources,
          lat: lead.lat ?? undefined,
          lng: lead.lng ?? undefined,
          score: lead.score,
          priority: lead.priority,
          category: lead.category || undefined,
          businessStatus: lead.businessStatus ?? null,
          aiAnalysis: { factors: lead.factors, recommendation: lead.recommendation, ...(lead.fit ? { fit: lead.fit } : {}) },
          marketingContent: marketingContent ?? undefined,
          campaignId,
          workspaceId,
        };
      }),
    );

    await this.leads.createMany(processed);
    await this.campaigns.refreshStats(campaignId);
    await this.campaigns.updateStatus(campaignId, "completed", 100, opts.note);
    this.geo.start(workspaceId); // province / kota / kecamatan for the new leads, in the background
    this.logger.log(`Campaign ${campaignId}: ${processed.length} leads saved`);

    // Contact details from each business's own website. Runs after the campaign is complete and never fails it.
    if (process.env.SCRAPER_MODE !== "fixture") {
      void this.enrichment.enrichCampaign(workspaceId, campaignId)
        .then((r) => this.logger.log(`Campaign ${campaignId} enrichment: ${JSON.stringify(r)}`))
        .catch((e) => this.logger.warn(`Campaign ${campaignId} enrichment failed: ${e}`));
    }
    return { saved: processed.length };
  }
}
