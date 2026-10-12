import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { memoryStorage } from "multer";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { BriefService } from "./brief.service";
import type { BriefContent } from "./brief-schema";

class UrlDto {
  @IsString() @MinLength(4) @MaxLength(500) url!: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
}
class TextDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsString() @MinLength(30) @MaxLength(200_000) content!: string;
}
class GenerateDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) sourceIds?: string[];
  @IsOptional() @IsString() @MaxLength(3000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsIn(["indonesian", "english"]) language?: "indonesian" | "english";
}
class SaveDto {
  @IsString() @MinLength(10) @MaxLength(600) summary!: string;
  @IsObject() content!: BriefContent;
}

const upload = FilesInterceptor("files", 5, { storage: memoryStorage(), limits: { fileSize: 10_000_000 } });

@ApiTags("Marketing")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("marketing")
export class MarketingController {
  constructor(private readonly brief: BriefService) {}

  @Get("sources")
  @ApiOperation({ summary: "Source material (links, text, files) the Marketing Brief is built from" })
  sources(@WorkspaceId() ws: string) {
    return this.brief.listSources(ws);
  }

  @Post("sources/url")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Read a website in the background: the given page plus the pages found through llms.txt, the sitemap and its links" })
  addUrl(@WorkspaceId() ws: string, @Body() dto: UrlDto) {
    return this.brief.addUrl(ws, dto.url, dto.title);
  }

  @Post("sources/text")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  addText(@WorkspaceId() ws: string, @Body() dto: TextDto) {
    return this.brief.addText(ws, dto.title, dto.content);
  }

  @Post("sources/file")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(upload)
  async addFiles(@WorkspaceId() ws: string, @UploadedFiles() files: { originalname: string; buffer: Buffer }[]) {
    const out = [];
    for (const f of files ?? []) out.push(await this.brief.addFile(ws, f));
    return out;
  }

  @Delete("sources/:id")
  removeSource(@WorkspaceId() ws: string, @Param("id") id: string) {
    return this.brief.removeSource(ws, id);
  }

  @Get("brief")
  async get(@WorkspaceId() ws: string) {
    // always a JSON object: an empty body breaks clients that call res.json()
    return (await this.brief.get(ws)) ?? { exists: false };
  }

  @Post("brief/generate")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Write the Marketing Brief and suggested campaign settings from the sources. Facts come only from the sources; gaps are listed as [NEED: ...]" })
  generate(@WorkspaceId() ws: string, @Body() dto: GenerateDto) {
    return this.brief.startGenerate(ws, dto);
  }

  @Get("brief/generate/status")
  @ApiOperation({ summary: "Progress of the brief being written; the finished brief is included when status is done" })
  generateStatus(@WorkspaceId() ws: string) {
    return this.brief.generateStatus(ws);
  }

  @Put("brief")
  save(@WorkspaceId() ws: string, @Body() dto: SaveDto) {
    return this.brief.save(ws, dto.summary, dto.content);
  }
}
