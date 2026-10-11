import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LimitsService } from "./limits.service";
import { parseEdition, type Edition, type Feature } from "./entitlements";

/** 402: the feature exists but needs a plan that includes it. The body carries a machine-readable code for the UI. */
export class UpgradeRequiredException extends HttpException {
  constructor(feature: Feature, edition: Edition) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "UPGRADE_REQUIRED",
        feature,
        message: edition === "community" ? "This feature is available on alatpintar.id or with a licence, not in the open-source edition." : "Your plan does not include this feature.",
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

const finite = (n: number) => (Number.isFinite(n) ? n : null);

@Injectable()
export class EntitlementsService {
  readonly edition: Edition;

  constructor(config: ConfigService, private readonly limits: LimitsService) {
    this.edition = parseEdition(config.get<string>("EDITION"));
  }

  async plan(workspaceId: string): Promise<string> {
    return (await this.limits.snapshotFor(workspaceId)).plan;
  }

  /** Plan, features, limits and this month's usage for the workspace's owner. Infinite limits are sent as null. */
  async list(workspaceId: string, userId?: string) {
    const snap = await this.limits.snapshotFor(workspaceId);
    const ownerId = await this.limits.ownerOf(workspaceId);
    const features = Object.fromEntries((["whatsapp.cloud_api", "ai.managed"] as Feature[]).map((f) => [f, snap.features.includes(f)])) as Record<Feature, boolean>;
    const usage = this.limits.enabled && ownerId ? await this.limits.usageForOwner(ownerId) : null;
    return {
      edition: this.edition,
      plan: snap.plan,
      enforcing: this.limits.enabled,
      status: snap.status,
      readOnly: snap.readOnly,
      endsAt: snap.endsAt,
      isOwner: !!userId && userId === ownerId,
      features,
      limits: { workspaces: finite(snap.limits.workspaces), membersPerWorkspace: finite(snap.limits.membersPerWorkspace), draftsPerMonth: finite(snap.limits.draftsPerMonth) },
      usage,
    };
  }

  async has(workspaceId: string, feature: Feature): Promise<boolean> {
    return (await this.limits.snapshotFor(workspaceId)).features.includes(feature);
  }

  async assert(workspaceId: string, feature: Feature): Promise<void> {
    if (!(await this.has(workspaceId, feature))) throw new UpgradeRequiredException(feature, this.edition);
  }
}
