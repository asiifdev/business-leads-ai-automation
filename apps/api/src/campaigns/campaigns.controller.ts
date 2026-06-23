import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CampaignsService } from "./campaigns.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

@ApiTags("Campaigns")
@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: "List all campaigns" })
  findAll() { return this.campaignsService.findAll(); }

  @Get(":id")
  @ApiOperation({ summary: "Get campaign by ID" })
  findOne(@Param("id") id: string) { return this.campaignsService.findOne(id); }

  @Post()
  @ApiOperation({ summary: "Create a new campaign" })
  create(@Body() dto: CreateCampaignDto) { return this.campaignsService.create(dto); }

  @Patch(":id")
  @ApiOperation({ summary: "Update a campaign" })
  update(@Param("id") id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a campaign" })
  remove(@Param("id") id: string) { return this.campaignsService.remove(id); }
}
