import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementsController } from "./entitlements.controller";
import { EntitlementsService } from "./entitlements.service";
import { CLOUD_HOST, type CloudHost } from "./cloud-host";
import { LicenseController } from "./license.controller";
import { LicenseProvider } from "./license.provider";
import { LimitsService } from "./limits.service";
import { loadCloudPlugin, type CloudDeps } from "./plugin";
import { CommunityProvider, ENTITLEMENT_PROVIDER, type EntitlementProvider } from "./provider";

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EntitlementsController, LicenseController],
  providers: [
    {
      provide: CLOUD_HOST,
      inject: [ConfigService, PrismaService, JwtService],
      useFactory: async (config: ConfigService, prisma: PrismaService, jwt: JwtService): Promise<CloudHost> => {
        const logger = new Logger("Entitlements");
        const community: CloudHost = { provider: new CommunityProvider(), router: null, license: null };
        // Hosted: the commercial package supplies per-account subscriptions. Anything else is a self-hosted install, which
        // is unlimited and unlocks premium features with a licence key (nothing is sent unless a key is set).
        if (config.get<string>("EDITION") !== "hosted") {
          const license = new LicenseProvider(prisma, {
            encryptionKey: config.get<string>("ENCRYPTION_KEY")!,
            envKey: config.get<string>("ALATPINTAR_LICENSE_KEY"),
            server: config.get<string>("ALATPINTAR_LICENSE_SERVER"),
            version: process.env.npm_package_version,
          });
          await license.init();
          return { provider: license, router: null, license };
        }
        const plugin = loadCloudPlugin();
        if (!plugin) {
          logger.warn("No commercial entitlement package installed: running as Community (no plans, no limits)");
          return community;
        }
        const deps: CloudDeps = {
          prisma,
          config,
          verifyToken: async (token) => {
            try {
              const p = await jwt.verifyAsync<{ sub: string; workspaceId: string; email?: string }>(token, { secret: config.get<string>("JWT_SECRET") });
              const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: p.workspaceId, userId: p.sub } }, select: { id: true } });
              return m ? p : null;
            } catch {
              return null;
            }
          },
        };
        const provider = await plugin.createProvider(deps);
        const router = plugin.createRouter ? await plugin.createRouter(deps, provider) : null;
        logger.log(`Entitlement provider: ${provider.name}`);
        return { provider, router, license: null };
      },
    },
    { provide: ENTITLEMENT_PROVIDER, inject: [CLOUD_HOST], useFactory: (h: CloudHost) => h.provider },
    LimitsService,
    EntitlementsService,
  ],
  exports: [EntitlementsService, LimitsService, ENTITLEMENT_PROVIDER, CLOUD_HOST],
})
export class EntitlementsModule {}
