import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { FollowUpService } from "./followup.service";
import { MAX_BODY, MAX_BULK, MAX_GENERATE, MessagingService } from "./messaging.service";

class IdsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(MAX_BULK) @IsString({ each: true }) ids!: string[];
}
class ManualDto {
  @IsString() @MinLength(6) @MaxLength(32) phone!: string;
  @IsString() @MinLength(1) @MaxLength(MAX_BODY) body!: string;
  @IsOptional() @IsString() leadId?: string;
}
class EditDto {
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
}
class GenerateDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_BULK) @IsString({ each: true }) leadIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(MAX_GENERATE) limit?: number;
}
class SettingsDto {
  @IsOptional() @IsIn(["baileys", "cloud_api"]) provider?: "baileys" | "cloud_api";
  @IsOptional() @IsInt() @Min(1) @Max(30) hourlyLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) dailyLimit?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) quietStartHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) quietEndHour?: number;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @Matches(/^\d{1,3}$/) defaultCountryCode?: string;
  @IsOptional() @IsBoolean() paused?: boolean;
}
class DisconnectDto {
  @IsOptional() @IsBoolean() logout?: boolean;
}

@ApiTags("Messaging")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("messaging")
export class MessagingController {
  constructor(private readonly messaging: MessagingService, private readonly followUps: FollowUpService) {}

  @Get("whatsapp")
  @ApiOperation({ summary: "Connection state, pairing QR, limits and usage" })
  overview(@WorkspaceId() ws: string) {
    return this.messaging.overview(ws);
  }

  @Post("whatsapp/connect")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  connect(@WorkspaceId() ws: string) {
    return this.messaging.connect(ws);
  }

  @Post("whatsapp/disconnect")
  disconnect(@WorkspaceId() ws: string, @Body() dto: DisconnectDto) {
    return this.messaging.disconnect(ws, dto.logout === true);
  }

  @Patch("whatsapp/settings")
  settings(@WorkspaceId() ws: string, @Body() dto: SettingsDto) {
    return this.messaging.updateSettings(ws, dto);
  }

  @Get("outbox")
  @ApiOperation({ summary: "Messages by status (comma separated), newest first" })
  list(@WorkspaceId() ws: string, @Query("status") status?: string, @Query("limit") limit?: string, @Query("channel") channel?: string) {
    return this.messaging.list(ws, status, Number(limit) || 100, channel);
  }

  @Get("outbox/counts")
  counts(@WorkspaceId() ws: string, @Query("channel") channel?: string) {
    return this.messaging.counts(ws, channel);
  }

  @Post("outbox/generate")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Start writing first-contact drafts in the background. Sends nothing." })
  generate(@WorkspaceId() ws: string, @Body() dto: GenerateDto) {
    return this.messaging.startGeneration(ws, dto);
  }

  @Get("outbox/generate/status")
  generationStatus(@WorkspaceId() ws: string) {
    // always a JSON object: an empty body breaks clients that call res.json()
    return this.messaging.generationStatus(ws) ?? { running: false, total: 0, done: 0, created: 0, failed: 0, skipped: { noValidPhone: 0, optedOut: 0, duplicateNumber: 0 }, firstError: null };
  }

  @Post("outbox/followups/run")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  runFollowUps(@WorkspaceId() ws: string) {
    return this.followUps.run(ws);
  }

  @Post("outbox/manual")
  @ApiOperation({ summary: "Create a one-off message as a draft. It still has to be approved before it is sent." })
  manual(@WorkspaceId() ws: string, @Body() dto: ManualDto) {
    return this.messaging.createManual(ws, dto);
  }

  @Post("outbox/approve")
  approve(@WorkspaceId() ws: string, @Body() dto: IdsDto) {
    return this.messaging.approve(ws, dto.ids);
  }

  @Post("outbox/reject")
  reject(@WorkspaceId() ws: string, @Body() dto: IdsDto) {
    return this.messaging.reject(ws, dto.ids);
  }

  @Post("outbox/cancel")
  cancel(@WorkspaceId() ws: string, @Body() dto: IdsDto) {
    return this.messaging.cancel(ws, dto.ids);
  }

  @Patch("outbox/:id")
  edit(@WorkspaceId() ws: string, @Param("id") id: string, @Body() dto: EditDto) {
    return this.messaging.edit(ws, id, dto.body, dto.subject);
  }

  @Post("outbox/:id/retry")
  retry(@WorkspaceId() ws: string, @Param("id") id: string) {
    return this.messaging.retry(ws, id);
  }

  @Get("leads/:leadId/thread")
  thread(@WorkspaceId() ws: string, @Param("leadId") leadId: string) {
    return this.messaging.thread(ws, leadId);
  }
}
