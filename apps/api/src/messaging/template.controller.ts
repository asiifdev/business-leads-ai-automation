import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { MAX_EMAIL_BODY } from "./messaging.service";
import { MAX_TEMPLATE_LEADS, TemplateService } from "./template.service";

class GenerateTemplateDto {
  @IsString() @MinLength(2) @MaxLength(80) segment!: string;
  @IsIn(["whatsapp", "email"]) channel!: "whatsapp" | "email";
  @IsOptional() @IsIn(["indonesian", "english"]) language?: "indonesian" | "english";
  @IsOptional() @IsIn(["pain", "observation", "outcome"]) variant?: "pain" | "observation" | "outcome";
  @IsOptional() @IsString() @MaxLength(600) offer?: string;
}
class ApplyTemplateDto {
  @IsIn(["whatsapp", "email"]) channel!: "whatsapp" | "email";
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(MAX_TEMPLATE_LEADS) @IsString({ each: true }) leadIds!: string[];
  @IsString() @MinLength(1) @MaxLength(MAX_EMAIL_BODY) body!: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsIn(["indonesian", "english"]) language?: "indonesian" | "english";
  @IsOptional() @IsString() @MaxLength(64) attachmentId?: string;
  @IsOptional() @IsBoolean() linkPreview?: boolean;
}

@ApiTags("Message templates")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("messaging/templates")
export class TemplateController {
  constructor(private readonly templates: TemplateService) {}

  @Get("categories")
  @ApiOperation({ summary: "Kinds of business among your leads, with how many are reachable by phone and by email" })
  categories(@WorkspaceId() ws: string) {
    return this.templates.categories(ws);
  }

  @Get("leads")
  @ApiOperation({ summary: "Leads of one kind of business, with whether each can be reached and already has a first message" })
  leads(@WorkspaceId() ws: string, @Query("channel") channel = "whatsapp", @Query("category") category?: string, @Query("q") q?: string, @Query("campaignId") campaignId?: string, @Query("limit") limit?: string) {
    return this.templates.leads(ws, { channel: channel === "email" ? "email" : "whatsapp", category, q, campaignId, limit: limit ? Number(limit) : undefined });
  }

  @Post("generate")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "The AI writes one generic message for a kind of business (uses one draft of your plan)" })
  generate(@WorkspaceId() ws: string, @Body() dto: GenerateTemplateDto) {
    return this.templates.generate(ws, dto);
  }

  @Post("apply")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Create one draft per selected lead from a single message. Nothing is sent before you approve" })
  apply(@WorkspaceId() ws: string, @Body() dto: ApplyTemplateDto) {
    return this.templates.apply(ws, dto);
  }
}
