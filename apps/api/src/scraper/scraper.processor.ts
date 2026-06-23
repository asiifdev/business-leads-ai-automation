import { Injectable, Logger } from "@nestjs/common";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadsService } from "../leads/leads.service";
import { LeadIntelligenceService } from "../ai/lead-intelligence.service";
import { MarketingAiService } from "../ai/marketing-ai.service";

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

@Injectable()
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private campaigns: CampaignsService,
    private leads: LeadsService,
    private leadIntelligence: LeadIntelligenceService,
    private marketingAi: MarketingAiService,
  ) {}

  async process(data: ScraperJobData): Promise<void> {
    const { campaignId, workspaceId } = data;
    this.logger.log(`Starting campaign ${campaignId}`);

    try {
      await this.campaigns.updateStatus(campaignId, "running", 0);

      const mockLeads = this.generateMockLeads(data);
      const total = mockLeads.length;

      await this.campaigns.updateStatus(campaignId, "running", 30);

      const scoredLeads = this.leadIntelligence.scoreLeads(mockLeads, data.industry);
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
            hasWebsite: lead.hasWebsite ?? false,
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
    }
  }

  private generateMockLeads(data: ScraperJobData) {
    const count = Math.min(data.maxResults, 15);
    const prefixes = [
      `${data.location} ${data.industry} Premier`,
      `Toko ${data.industry} Jaya`,
      `${data.industry} Makmur`,
      `Usaha ${data.industry} Sejahtera`,
      `${data.industry} Berkah`,
      `Toko ${data.industry} Mandiri`,
      `${data.industry} Maju`,
      `${data.industry} Bersama`,
      `${data.industry} Sukses`,
      `${data.industry} Abadi`,
      `${data.industry} Sejati`,
      `Toko ${data.industry} Utama`,
      `${data.industry} Kreatif`,
      `${data.industry} Modern`,
      `${data.industry} Digital`,
    ];
    return Array.from({ length: count }, (_, i) => ({
      name: prefixes[i % prefixes.length] + (i >= prefixes.length ? ` ${i + 1}` : ""),
      address: `Jl. ${data.location} No. ${10 + i}, ${data.location}`,
      phone: `+628${String(10000000 + Math.floor(Math.random() * 89999999))}`,
      website: Math.random() > 0.4 ? `www.${data.industry.toLowerCase()}${i + 1}.com` : "",
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      hasWebsite: Math.random() > 0.4,
      industry: data.industry,
    }));
  }
}
