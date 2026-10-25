import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadCollectorService } from "./lead-collector.service";
import { LeadPipelineService } from "./lead-pipeline.service";
import type { ImportJobData, WebsiteJobData } from "./lead-import.service";
import { WebsiteListService } from "./website-list.service";

export { leadKey } from "./lead-key";

export interface ScraperJobData {
  campaignId: string;
  workspaceId: string;
  searchQueries: string[];
  /** Where to look, in order. Campaigns made before sources existed have only google_maps. */
  sources?: string[];
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
    private collector: LeadCollectorService,
    private pipeline: LeadPipelineService,
    private websites: WebsiteListService,
  ) {
    super();
  }

  async process(job: Job<ScraperJobData | ImportJobData | WebsiteJobData>): Promise<void> {
    if (job.name === "import") return this.runImport(job.data as ImportJobData);
    if (job.name === "import-websites") return this.runWebsites(job.data as WebsiteJobData);
    const data = job.data as ScraperJobData;
    const { campaignId } = data;
    this.logger.log(`Starting campaign ${campaignId} (job ${job.id})`);

    try {
      await this.campaigns.updateStatus(campaignId, "running", 0);

      const found = await this.collector.collect({
        sources: data.sources ?? ["google_maps"],
        searchQueries: data.searchQueries,
        location: data.location,
        industry: data.industry,
        maxResults: data.maxResults,
        onProgress: (pct) => this.campaigns.updateStatus(campaignId, "running", Math.min(28, Math.round(pct * 0.28))).then(() => undefined),
      });
      if (found.leads.length === 0) {
        await this.campaigns.updateStatus(campaignId, "failed", 0, "No leads found");
        return;
      }

      // A source that failed while another produced leads is shown with the finished campaign.
      await this.pipeline.ingest(data, found.leads, { from: 30, note: found.warnings.length ? `Some sources failed: ${found.warnings.join("; ")}` : undefined });
    } catch (err) {
      this.logger.error(`Campaign ${campaignId} failed: ${err}`);
      await this.campaigns.updateStatus(campaignId, "failed", undefined, (err as Error).message ?? String(err));
      throw err; // re-throw so BullMQ can retry if configured
    }
  }

  /** Each pasted website is read for its name and details, then the leads go through the same steps as any other. */
  private async runWebsites(data: WebsiteJobData): Promise<void> {
    const { campaignId, workspaceId } = data;
    try {
      const campaign = await this.campaigns.findOne(campaignId, workspaceId);
      const read = await this.websites.read(data.urls, campaign.industry);
      const skipped = [...read.unreachable.map((h) => `${h} (could not be opened)`), ...read.parked.map((h) => `${h} (parked or unfinished)`)];
      const note = `Read ${read.leads.length} of ${data.urls.length} websites${skipped.length ? `. Left out: ${skipped.slice(0, 6).join(", ")}${skipped.length > 6 ? ` and ${skipped.length - 6} more` : ""}` : ""}`.slice(0, 300);
      if (read.leads.length === 0) {
        await this.campaigns.updateStatus(campaignId, "completed", 100, note);
        return;
      }
      await this.pipeline.ingest({ campaignId, workspaceId, industry: campaign.industry, yourService: campaign.yourService, contentStyle: campaign.contentStyle, language: campaign.language }, read.leads, { from: 10, note });
    } catch (err) {
      this.logger.error(`Website list for campaign ${campaignId} failed: ${err}`);
      await this.campaigns.updateStatus(campaignId, "completed", 100, `Reading the websites failed: ${(err as Error).message ?? err}`.slice(0, 300));
    }
  }

  /** Leads from an uploaded file go through the same steps as scraped ones. A failed import leaves the campaign as it was, with a message. */
  private async runImport(data: ImportJobData): Promise<void> {
    const { campaignId, workspaceId } = data;
    try {
      const campaign = await this.campaigns.findOne(campaignId, workspaceId);
      await this.pipeline.ingest({ campaignId, workspaceId, industry: campaign.industry, yourService: campaign.yourService, contentStyle: campaign.contentStyle, language: campaign.language }, data.leads, { from: 0, note: `Imported ${data.leads.length} rows from ${data.fileName}` });
    } catch (err) {
      this.logger.error(`Import into campaign ${campaignId} failed: ${err}`);
      await this.campaigns.updateStatus(campaignId, "completed", 100, `Import failed: ${(err as Error).message ?? err}`.slice(0, 300));
    }
  }
}
