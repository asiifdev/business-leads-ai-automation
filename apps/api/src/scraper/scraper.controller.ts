import { Controller, Post, Param, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ScraperProcessor } from "./scraper.processor";
import { CampaignsService } from "../campaigns/campaigns.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";

@ApiTags("Scraper")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("scraper")
export class ScraperController {
  constructor(
    private readonly processor: ScraperProcessor,
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
    // Fire-and-forget background job
    this.processor.process({
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      searchQueries: campaign.searchQueries,
      industry: campaign.industry,
      location: campaign.location,
      maxResults: campaign.maxResults,
      yourService: campaign.yourService,
      contentStyle: campaign.contentStyle,
      language: campaign.language,
    }).catch((err) => console.error("Scraper failed:", err));
    return { message: "Campaign started", campaignId: id };
  }
}
