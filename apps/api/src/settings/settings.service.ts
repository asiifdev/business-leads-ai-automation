import { randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_WORKSPACE_ID = "default-workspace";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getIntegrations(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.integration.findMany({ where: { workspaceId } });
  }

  async upsertIntegration(
    type: string,
    name: string,
    config: Record<string, string>,
    workspaceId = DEFAULT_WORKSPACE_ID,
  ) {
    const existing = await this.prisma.integration.findFirst({ where: { workspaceId, type } });
    if (existing) {
      return this.prisma.integration.update({ where: { id: existing.id }, data: { config, enabled: true } });
    }
    return this.prisma.integration.create({ data: { type, name, config, workspaceId } });
  }

  async listApiKeys(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
  }

  async createApiKey(name: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const key = `px_${randomBytes(32).toString("base64url")}`;
    return this.prisma.apiKey.create({ data: { name, key, workspaceId } });
  }

  async deleteApiKey(id: string) {
    return this.prisma.apiKey.delete({ where: { id } });
  }
}
