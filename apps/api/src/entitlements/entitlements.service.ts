import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { featuresFor, parseEdition, type Edition, type Feature } from "./entitlements";

/** 402: the feature exists but needs a plan that includes it. The body carries a machine-readable code for the UI. */
export class UpgradeRequiredException extends HttpException {
  constructor(feature: Feature, edition: Edition) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "UPGRADE_REQUIRED",
        feature,
        message: edition === "community" ? "This feature is available on alatpintar.id, not in the open-source edition." : "Your plan does not include this feature.",
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

@Injectable()
export class EntitlementsService {
  readonly edition: Edition;

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    this.edition = parseEdition(config.get<string>("EDITION"));
  }

  async plan(workspaceId: string): Promise<string> {
    return (await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } }))?.plan ?? "free";
  }

  async list(workspaceId: string) {
    const plan = await this.plan(workspaceId);
    return { edition: this.edition, plan, features: featuresFor(this.edition, plan) };
  }

  async has(workspaceId: string, feature: Feature): Promise<boolean> {
    return featuresFor(this.edition, await this.plan(workspaceId))[feature];
  }

  async assert(workspaceId: string, feature: Feature): Promise<void> {
    if (!(await this.has(workspaceId, feature))) throw new UpgradeRequiredException(feature, this.edition);
  }
}
