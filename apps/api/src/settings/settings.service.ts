import { randomBytes, createHash } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { encryptSecret, decryptSecret } from "./encryption.util";

const DEFAULT_WORKSPACE_ID = "default-workspace";
const SECRET_CONFIG_KEYS = ["apiKey"];

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.get<string>("ENCRYPTION_KEY")!;
  }

  private decryptConfig(config: Record<string, string>): Record<string, string> {
    const result = { ...config };
    for (const key of SECRET_CONFIG_KEYS) {
      if (result[key]) result[key] = decryptSecret(result[key], this.encryptionKey);
    }
    return result;
  }

  private encryptConfig(config: Record<string, string>): Record<string, string> {
    const result = { ...config };
    for (const key of SECRET_CONFIG_KEYS) {
      if (result[key]) result[key] = encryptSecret(result[key], this.encryptionKey);
    }
    return result;
  }

  async getIntegrations(workspaceId = DEFAULT_WORKSPACE_ID) {
    const integrations = await this.prisma.integration.findMany({ where: { workspaceId } });
    return integrations.map((integration) => ({
      ...integration,
      config: this.decryptConfig(integration.config as Record<string, string>),
    }));
  }

  async upsertIntegration(
    type: string,
    name: string,
    config: Record<string, string>,
    workspaceId = DEFAULT_WORKSPACE_ID,
  ) {
    const encryptedConfig = this.encryptConfig(config);
    const existing = await this.prisma.integration.findFirst({ where: { workspaceId, type } });
    if (existing) {
      return this.prisma.integration.update({
        where: { id: existing.id },
        data: { config: encryptedConfig, enabled: true },
      });
    }
    return this.prisma.integration.create({ data: { type, name, config: encryptedConfig, workspaceId } });
  }

  async listApiKeys(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
  }

  async createApiKey(name: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const plaintext = `px_${randomBytes(32).toString("base64url")}`;
    const keyHash = createHash("sha256").update(plaintext).digest("hex");
    const keyPrefix = plaintext.slice(0, 10); // "px_" + first 7 chars

    await this.prisma.apiKey.create({
      data: { name, keyHash, keyPrefix, workspaceId },
    });

    // Return the plaintext key exactly once — it is never stored and cannot be recovered
    return { name, keyPrefix, key: plaintext, note: "Store this key securely — it will not be shown again." };
  }

  async deleteApiKey(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException("API key not found");
    return this.prisma.apiKey.delete({ where: { id } });
  }
}
