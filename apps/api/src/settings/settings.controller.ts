import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { CurrentUserId } from "../auth/current-user.decorator";

@ApiTags("Settings")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("integrations")
  @ApiOperation({ summary: "List workspace integrations" })
  getIntegrations(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getIntegrations(workspaceId);
  }

  @Post("integrations")
  @ApiOperation({ summary: "Save or update an integration" })
  upsertIntegration(
    @WorkspaceId() workspaceId: string,
    @Body() body: { type: string; name: string; config: Record<string, string> },
  ) {
    return this.settingsService.upsertIntegration(body.type, body.name, body.config, workspaceId);
  }

  @Get("ai")
  @ApiOperation({ summary: "Which AI provider this workspace uses (its own key or the server's) and whether stored vectors need redoing" })
  aiStatus(@WorkspaceId() workspaceId: string) {
    return this.settingsService.aiStatus(workspaceId);
  }

  @Put("ai")
  @ApiOperation({ summary: "Save this workspace's own AI provider. A blank apiKey keeps the saved one." })
  saveAi(
    @WorkspaceId() workspaceId: string,
    @CurrentUserId() userId: string,
    @Body() body: { apiKey?: string; model?: string; embeddingModel?: string; baseURL?: string },
  ) {
    return this.settingsService.saveAi(workspaceId, body ?? {}, userId);
  }

  @Delete("ai")
  @ApiOperation({ summary: "Remove this workspace's own AI provider and fall back to the server's" })
  clearAi(@WorkspaceId() workspaceId: string, @CurrentUserId() userId: string) {
    return this.settingsService.clearAi(workspaceId, userId);
  }

  @Post("ai/test")
  @ApiOperation({ summary: "Make one real chat and one embedding call with the settings this workspace uses" })
  testAi(@WorkspaceId() workspaceId: string) {
    return this.settingsService.testAi(workspaceId);
  }

  @Get("api-keys")
  @ApiOperation({ summary: "List API keys" })
  listApiKeys(@WorkspaceId() workspaceId: string) {
    return this.settingsService.listApiKeys(workspaceId);
  }

  @Post("api-keys")
  @ApiOperation({ summary: "Create a new API key" })
  createApiKey(
    @WorkspaceId() workspaceId: string,
    @Body() body: { name: string },
  ) {
    return this.settingsService.createApiKey(body.name, workspaceId);
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Delete an API key" })
  deleteApiKey(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    return this.settingsService.deleteApiKey(id, workspaceId);
  }
}
