import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { CurrentUserId } from "../auth/current-user.decorator";
import { KnowledgeService } from "./knowledge.service";

class AddKnowledgeDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(200_000) content!: string;
  @IsOptional() @IsString() kind?: string;
}
class SearchKnowledgeDto {
  @IsString() @MinLength(2) @MaxLength(1000) query!: string;
}

@ApiTags("Knowledge")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get("sources")
  @ApiOperation({ summary: "List knowledge sources (FAQ, catalog, notes) used to ground AI answers" })
  list(@WorkspaceId() workspaceId: string) {
    return this.knowledge.list(workspaceId);
  }

  @Post("sources")
  @ApiOperation({ summary: "Add a text source; it is chunked and embedded with pgvector" })
  add(@WorkspaceId() workspaceId: string, @Body() dto: AddKnowledgeDto) {
    return this.knowledge.addText(workspaceId, dto);
  }

  @Delete("sources/:id")
  remove(@WorkspaceId() workspaceId: string, @Param("id") id: string) {
    return this.knowledge.remove(workspaceId, id);
  }

  @Post("reindex")
  @ApiOperation({ summary: "Embed every source again with the workspace's current embedding model" })
  reindex(@WorkspaceId() workspaceId: string, @CurrentUserId() userId: string) {
    return this.knowledge.reindexAll(workspaceId, userId);
  }

  @Post("search")
  @ApiOperation({ summary: "Semantic search over the workspace knowledge with a confidence level" })
  search(@WorkspaceId() workspaceId: string, @Body() dto: SearchKnowledgeDto) {
    return this.knowledge.search(workspaceId, dto.query);
  }
}
