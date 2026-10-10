import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../prisma/prisma.service";
import type { WhatsappProvider } from "./whatsapp.provider";

export interface CloudPluginDeps {
  prisma: PrismaService;
  config: ConfigService;
}

/**
 * The official WhatsApp Business Cloud API connector is a commercial module that is not part of this repository.
 * If a package named by WHATSAPP_CLOUD_PLUGIN (default "@alatpintar/whatsapp-cloud") is installed and exports
 * `createProvider(deps)`, it is used; otherwise the community behaviour applies. It implements the same
 * WhatsappProvider interface as Baileys, so the queue, limits and approval flow do not change.
 */
export function loadCloudProvider(deps: CloudPluginDeps, name = process.env.WHATSAPP_CLOUD_PLUGIN || "@alatpintar/whatsapp-cloud"): WhatsappProvider | null {
  const logger = new Logger("CloudPlugin");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(name) as { createProvider?: (d: CloudPluginDeps) => WhatsappProvider; default?: { createProvider?: (d: CloudPluginDeps) => WhatsappProvider } };
    const create = mod.createProvider ?? mod.default?.createProvider;
    if (typeof create !== "function") {
      logger.warn(`${name} does not export createProvider(); the official WhatsApp connector is off`);
      return null;
    }
    return create(deps);
  } catch (e) {
    if ((e as { code?: string }).code !== "MODULE_NOT_FOUND") logger.error(`Could not load ${name}: ${(e as Error).message}`);
    return null;
  }
}
