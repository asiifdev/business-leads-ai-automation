import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: "Get analytics overview" })
  getOverview(@WorkspaceId() workspaceId: string) {
    return this.analyticsService.getOverview(workspaceId);
  }

  @Get("industries")
  @ApiOperation({ summary: "Get leads grouped by industry" })
  getByIndustry(@WorkspaceId() workspaceId: string) {
    return this.analyticsService.getLeadsByIndustry(workspaceId);
  }

  @Get("campaigns")
  @ApiOperation({ summary: "Get campaign performance stats" })
  getCampaignStats(@WorkspaceId() workspaceId: string) {
    return this.analyticsService.getCampaignStats(workspaceId);
  }
}
