import { Controller, Post, Param, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CampaignsService } from "../campaigns/campaigns.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { ScraperJobData } from "./scraper.processor";

@ApiTags("Scraper")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("scraper")
export class ScraperController {
  constructor(
    @InjectQueue("scraper") private readonly scraperQueue: Queue<ScraperJobData>,
    private readonly campaigns: CampaignsService,
  ) {}

  @Post("campaigns/:id/start")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Start campaign scraping job" })
  async startCampaign(
    @Param("id") id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    const campaign = await this.campaigns.findOne(id, workspaceId);
    const job = await this.scraperQueue.add(
      "scrape",
      {
        campaignId: campaign.id,
        workspaceId: campaign.workspaceId,
        searchQueries: campaign.searchQueries,
        industry: campaign.industry,
        location: campaign.location,
        maxResults: campaign.maxResults,
        yourService: campaign.yourService,
        contentStyle: campaign.contentStyle,
        language: campaign.language,
      },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    return { message: "Campaign queued", campaignId: id, jobId: job.id };
  }
}
