import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { RequestHandler } from "express";
import type { PrismaService } from "../prisma/prisma.service";
import type { EntitlementProvider } from "./provider";

export interface TokenPayload {
  sub: string;
  workspaceId: string;
  email?: string;
}

export interface CloudDeps {
  prisma: PrismaService;
  config: ConfigService;
  /** Verifies a bearer token (signature, expiry and workspace membership). Null when invalid. */
  verifyToken(token: string): Promise<TokenPayload | null>;
}

export interface CloudPlugin {
  createProvider(deps: CloudDeps): EntitlementProvider | Promise<EntitlementProvider>;
  /** Optional HTTP routes (checkout, payment webhooks, billing admin), mounted by the host at /api/billing. */
  createRouter?(deps: CloudDeps, provider: EntitlementProvider): RequestHandler | Promise<RequestHandler>;
}

/**
 * Commercial plans, subscriptions, licence keys and payments live in a separate private package, never in this
 * repository. If the package named by ALATPINTAR_CLOUD_PLUGIN (default "@alatpintar/cloud") is installed and exports
 * `createProvider(deps)`, it supplies the entitlements; otherwise the Community behaviour applies.
 */
export function loadCloudPlugin(name = process.env.ALATPINTAR_CLOUD_PLUGIN || "@alatpintar/cloud"): CloudPlugin | null {
  const logger = new Logger("CloudPlugin");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(name) as Partial<CloudPlugin> & { default?: Partial<CloudPlugin> };
    const createProvider = mod.createProvider ?? mod.default?.createProvider;
    if (typeof createProvider !== "function") {
      logger.warn(`${name} does not export createProvider(); running as Community`);
      return null;
    }
    return { createProvider, createRouter: mod.createRouter ?? mod.default?.createRouter };
  } catch (e) {
    if ((e as { code?: string }).code !== "MODULE_NOT_FOUND") logger.error(`Could not load ${name}: ${(e as Error).message}`);
    return null;
  }
}
