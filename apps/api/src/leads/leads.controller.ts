import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { EnrichmentService } from "./enrichment.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";

@ApiTags("Leads")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService, private readonly enrichment: EnrichmentService) {}

  @Get()
  @ApiOperation({ summary: "List all leads" })
  @ApiQuery({ name: "campaignId", required: false })
  @ApiQuery({ name: "q", required: false, description: "Search by name" })
  @ApiQuery({ name: "priority", required: false, enum: ["HIGH", "MEDIUM", "LOW"] })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @WorkspaceId() workspaceId: string,
    @Query("campaignId") campaignId?: string,
    @Query("q") q?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.leadsService.findAll(workspaceId, {
      campaignId, q, priority, status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("enrich/campaign/:campaignId")
  @ApiOperation({ summary: "Read each lead's own website for emails, WhatsApp numbers and social profiles (up to 50 per call)" })
  enrichCampaign(@Param("campaignId") campaignId: string, @WorkspaceId() workspaceId: string) {
    return this.enrichment.enrichCampaign(workspaceId, campaignId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":id/enrich")
  @ApiOperation({ summary: "Read one lead's website for contact details" })
  enrichOne(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    return this.enrichment.enrichLead(workspaceId, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get lead by ID" })
  findOne(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    return this.leadsService.findOne(id, workspaceId);
  }

  @Patch(":id/crm")
  @ApiOperation({ summary: "Update CRM status for a lead" })
  updateCrm(@Param("id") id: string, @Body() dto: UpdateCrmDto, @WorkspaceId() workspaceId: string) {
    return this.leadsService.updateCrm(id, dto, workspaceId);
  }
}
