import { Controller, Get, Post, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";

@ApiTags("Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("integrations")
  @ApiOperation({ summary: "List workspace integrations" })
  getIntegrations() { return this.settingsService.getIntegrations(); }

  @Post("integrations")
  @ApiOperation({ summary: "Save or update an integration" })
  upsertIntegration(@Body() body: { type: string; name: string; config: Record<string, string> }) {
    return this.settingsService.upsertIntegration(body.type, body.name, body.config);
  }

  @Get("api-keys")
  @ApiOperation({ summary: "List API keys" })
  listApiKeys() { return this.settingsService.listApiKeys(); }

  @Post("api-keys")
  @ApiOperation({ summary: "Create a new API key" })
  createApiKey(@Body() body: { name: string }) {
    return this.settingsService.createApiKey(body.name);
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Delete an API key" })
  deleteApiKey(@Param("id") id: string) { return this.settingsService.deleteApiKey(id); }
}
