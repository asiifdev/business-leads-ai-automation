import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { AttachmentService } from "./attachment.service";
import { MAX_ATTACHMENT_BYTES } from "./attachment-file";
import { buildLinkPreview } from "./link-preview";
import { FollowUpService } from "./followup.service";
import { ReclassifyService } from "./reclassify.service";
import { MAX_BODY, MAX_BULK, MAX_EMAIL_BODY, MAX_GENERATE, MessagingService } from "./messaging.service";

class IdsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(MAX_BULK) @IsString({ each: true }) ids!: string[];
}
class ManualDto {
  @IsString() @MinLength(6) @MaxLength(32) phone!: string;
  @IsString() @MinLength(1) @MaxLength(MAX_BODY) body!: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() @MaxLength(64) attachmentId?: string;
  @IsOptional() @IsBoolean() linkPreview?: boolean;
}
class EditDto {
  @IsString() @MinLength(1) @MaxLength(MAX_EMAIL_BODY) body!: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  /** A file id to attach, or null to take the file off. */
  @IsOptional() @IsString() @MaxLength(64) attachmentId?: string | null;
  @IsOptional() @IsBoolean() linkPreview?: boolean;
}
class ReclassifyDto {
  /** false (default) only shows what would change; true applies it. */
  @IsOptional() @IsBoolean() apply?: boolean;
  @IsOptional() @IsBoolean() useAi?: boolean;
}
class LinkPreviewDto {
  @IsString() @MinLength(8) @MaxLength(500) url!: string;
}
class GenerateDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_BULK) @IsString({ each: true }) leadIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(MAX_GENERATE) limit?: number;
  @IsOptional() @IsBoolean() includeMedium?: boolean;
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
  constructor(private readonly messaging: MessagingService, private readonly followUps: FollowUpService, private readonly attachments: AttachmentService, private readonly reclassify: ReclassifyService) {}

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

  @Post("attachments")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } }))
  @ApiOperation({ summary: "Upload a file (PDF, image, MP4, DOCX, XLSX, PPTX, up to 16 MB) to send with WhatsApp messages" })
  upload(@WorkspaceId() ws: string, @UploadedFile() file?: { originalname: string; buffer: Buffer }) {
    if (!file) throw new BadRequestException("Choose a file to upload");
    return this.attachments.save(ws, file);
  }

  @Get("attachments")
  @ApiOperation({ summary: "Files you have uploaded" })
  listAttachments(@WorkspaceId() ws: string) {
    return this.attachments.list(ws);
  }

  @Delete("attachments/:id")
  @ApiOperation({ summary: "Delete an uploaded file (refused while a waiting message still uses it)" })
  deleteAttachment(@WorkspaceId() ws: string, @Param("id") id: string) {
    return this.attachments.remove(ws, id);
  }

  @Post("link-preview")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "The card WhatsApp will show under a link: title, description and picture" })
  async linkPreview(@Body() dto: LinkPreviewDto) {
    try {
      return await buildLinkPreview(dto.url);
    } catch (e) {
      throw e instanceof BadRequestException ? e : new BadRequestException((e as Error).message);
    }
  }

  @Post("reclassify")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Read every conversation again as a whole (your own phone messages included). Preview by default; send apply=true to apply" })
  reclassifyConversations(@WorkspaceId() ws: string, @Body() dto: ReclassifyDto) {
    return this.reclassify.run(ws, { apply: dto.apply === true, useAi: dto.useAi });
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
    return this.messaging.edit(ws, id, dto.body, dto.subject, { attachmentId: dto.attachmentId, linkPreview: dto.linkPreview });
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
