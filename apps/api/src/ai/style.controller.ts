import { Body, Controller, Delete, Get, Post, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { memoryStorage } from "multer";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { StyleService, type UploadedFile } from "./style.service";

class DraftDto {
  @IsString() @MinLength(1) @MaxLength(2000) incoming!: string;
  @IsOptional() @IsString() @MaxLength(500) businessDescription?: string;
}
class TrainDto {
  @IsString() @MinLength(1) @MaxLength(200) me!: string;
}

const upload = FilesInterceptor("files", 8, { storage: memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

@ApiTags("Style")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("style")
export class StyleController {
  constructor(private readonly style: StyleService) {}

  @Post("inspect")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(upload)
  @ApiOperation({ summary: "Read WhatsApp exports (.txt/.zip) and list participants. Nothing is stored." })
  inspect(@UploadedFiles() files: UploadedFile[]) {
    return this.style.inspect(files ?? []);
  }

  @Post("train")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(upload)
  @ApiOperation({ summary: "Learn the owner's writing style from exports; stores statistics and anonymized examples only" })
  train(@WorkspaceId() workspaceId: string, @UploadedFiles() files: UploadedFile[], @Body() dto: TrainDto) {
    return this.style.train(workspaceId, files ?? [], dto.me);
  }

  @Get("profile")
  profile(@WorkspaceId() workspaceId: string) {
    return this.style.profile(workspaceId);
  }

  @Delete("profile")
  @ApiOperation({ summary: "Delete the learned style and all stored examples" })
  remove(@WorkspaceId() workspaceId: string) {
    return this.style.remove(workspaceId);
  }

  @Post("draft")
  @ApiOperation({ summary: "Draft a reply in the owner's voice and return the full trace" })
  draft(@WorkspaceId() workspaceId: string, @Body() dto: DraftDto) {
    return this.style.draft(workspaceId, dto.incoming, dto.businessDescription);
  }
}
