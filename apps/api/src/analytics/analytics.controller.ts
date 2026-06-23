import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: "Get analytics overview" })
  getOverview() { return this.analyticsService.getOverview(); }

  @Get("industries")
  @ApiOperation({ summary: "Get leads grouped by industry" })
  getByIndustry() { return this.analyticsService.getLeadsByIndustry(); }

  @Get("campaigns")
  @ApiOperation({ summary: "Get campaign performance stats" })
  getCampaignStats() { return this.analyticsService.getCampaignStats(); }
}
