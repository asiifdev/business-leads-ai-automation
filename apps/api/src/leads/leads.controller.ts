import { Controller, Get, Patch, Param, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";

@ApiTags("Leads")
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: "List all leads" })
  @ApiQuery({ name: "campaignId", required: false })
  findAll(@Query("campaignId") campaignId?: string) {
    return this.leadsService.findAll(undefined, campaignId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get lead by ID" })
  findOne(@Param("id") id: string) { return this.leadsService.findOne(id); }

  @Patch(":id/crm")
  @ApiOperation({ summary: "Update CRM status for a lead" })
  updateCrm(@Param("id") id: string, @Body() dto: UpdateCrmDto) {
    return this.leadsService.updateCrm(id, dto);
  }
}
