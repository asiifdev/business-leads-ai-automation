import { Body, Controller, Post, Param, HttpCode, HttpStatus, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { LimitsService } from "../entitlements/limits.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { ScraperJobData } from "./scraper.processor";
import { LeadImportService, type ScraperJob } from "./lead-import.service";
import { MAX_IMPORT_BYTES } from "../leads/import/csv";
import { IsString, MaxLength, MinLength } from "class-validator";

class WebsiteListDto {
  @IsString() @MinLength(3) @MaxLength(40_000) text!: string;
}

@ApiTags("Scraper")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("scraper")
export class ScraperController {
  constructor(
    @InjectQueue("scraper") private readonly scraperQueue: Queue<ScraperJob>,
    private readonly campaigns: CampaignsService,
    private readonly limits: LimitsService,
    private readonly imports: LeadImportService,
  ) {}

  @Post("campaigns/:id/start")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Start campaign scraping job" })
  async startCampaign(
    @Param("id") id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    const campaign = await this.campaigns.findOne(id, workspaceId);
    await this.limits.assertCan(workspaceId, "scrape");
    await this.limits.record(workspaceId, "scrape");
    const job = await this.scraperQueue.add(
      "scrape",
      {
        campaignId: campaign.id,
        workspaceId: campaign.workspaceId,
        searchQueries: campaign.searchQueries,
        sources: campaign.sources,
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

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("campaigns/:id/import/preview")
  @ApiOperation({ summary: "Read a CSV or .xlsx file and show its columns, the columns Prospex would use, a sample and what an import would do" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  async previewImport(@Param("id") id: string, @WorkspaceId() workspaceId: string, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file) throw new BadRequestException("Choose a CSV or .xlsx file");
    const campaign = await this.campaigns.findOne(id, workspaceId);
    return this.imports.preview(file, campaign.industry);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("campaigns/:id/import")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Add the businesses in a CSV or .xlsx file to a campaign (scored, checked for repeats and enriched like scraped leads)" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  async importLeads(
    @Param("id") id: string,
    @WorkspaceId() workspaceId: string,
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
    @Body("mapping") mapping?: string,
  ) {
    if (!file) throw new BadRequestException("Choose a CSV or .xlsx file");
    return this.imports.start(workspaceId, id, file, mapping);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("campaigns/:id/import/websites")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Add the businesses behind a pasted list of websites (or Instagram/Facebook pages) to a campaign: up to 200, each page is read for the name and details" })
  async importWebsites(@Param("id") id: string, @WorkspaceId() workspaceId: string, @Body() body: WebsiteListDto) {
    return this.imports.startWebsites(workspaceId, id, body.text);
  }
}
