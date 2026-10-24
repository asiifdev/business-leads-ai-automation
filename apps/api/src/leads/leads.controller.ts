import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { EnrichmentService } from "./enrichment.service";
import { GeoService } from "./geo.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";

class ReferralDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsString() @MinLength(8) @MaxLength(40) phone!: string;
}

@ApiTags("Leads")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService, private readonly enrichment: EnrichmentService, private readonly geo: GeoService) {}

  @Get()
  @ApiOperation({ summary: "List all leads" })
  @ApiQuery({ name: "campaignId", required: false })
  @ApiQuery({ name: "q", required: false, description: "Search by name, address (city/province), phone, website, email or category" })
  @ApiQuery({ name: "priority", required: false, enum: ["HIGH", "MEDIUM", "LOW"] })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "quality", required: false, enum: ["high", "medium", "low"], description: "Data quality (how far the contact data can be trusted)" })
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
    @Query("province") province?: string,
    @Query("regency") regency?: string,
    @Query("district") district?: string,
    @Query("quality") quality?: string,
  ) {
    return this.leadsService.findAll(workspaceId, {
      campaignId, q, priority, status, province, regency, district, quality,
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

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("enrich/stale")
  @ApiOperation({ summary: "Read again the website or Instagram/Facebook page of leads that were never read or not for 90 days (up to 50 per call; remaining says how many are left)" })
  enrichStale(@WorkspaceId() workspaceId: string) {
    return this.enrichment.enrichStale(workspaceId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":id/enrich")
  @ApiOperation({ summary: "Read one lead's website for contact details" })
  enrichOne(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    return this.enrichment.enrichLead(workspaceId, id);
  }

  @Get("map")
  @ApiOperation({ summary: "Every lead with coordinates, for the map (same filters as the list, no paging)" })
  map(
    @WorkspaceId() workspaceId: string,
    @Query("campaignId") campaignId?: string,
    @Query("q") q?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
    @Query("province") province?: string,
    @Query("regency") regency?: string,
    @Query("district") district?: string,
    @Query("quality") quality?: string,
  ) {
    return this.leadsService.mapPoints(workspaceId, { campaignId, q, priority, status, province, regency, district, quality });
  }

  @Get("regions")
  @ApiOperation({ summary: "Province / kabupaten-kota / kecamatan with lead counts, and how far the area lookup has got" })
  async regions(@WorkspaceId() workspaceId: string, @Query("campaignId") campaignId?: string) {
    return { regions: await this.leadsService.regions(workspaceId, campaignId), geo: await this.geo.status(workspaceId) };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("quality/recompute")
  @ApiOperation({ summary: "Mark repeated businesses and rate the data quality of every lead again (also fills in data for leads saved earlier)" })
  recomputeQuality(@WorkspaceId() workspaceId: string) {
    return this.leadsService.recomputeQuality(workspaceId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("geo/backfill")
  @ApiOperation({ summary: "Work out province / kabupaten-kota / kecamatan for leads that have coordinates" })
  async backfillRegions(@WorkspaceId() workspaceId: string) {
    this.geo.start(workspaceId);
    return this.geo.status(workspaceId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":id/referral")
  @ApiOperation({ summary: "Add a contact this lead passed us as a lead of its own (never twice for the same number)" })
  addReferral(@Param("id") id: string, @Body() dto: ReferralDto, @WorkspaceId() workspaceId: string) {
    return this.leadsService.createFromReferral(workspaceId, id, dto);
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
