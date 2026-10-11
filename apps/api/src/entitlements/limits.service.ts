import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ENTITLEMENT_PROVIDER, type EntitlementProvider, type EntitlementSnapshot } from "./provider";

/** 402 with a machine-readable code, so the UI can show "you reached your plan's limit" rather than a generic error. */
export class LimitReachedException extends HttpException {
  constructor(readonly metric: string, readonly limit: number, readonly used: number, readonly reason: "limit" | "read_only") {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: reason === "read_only" ? "SUBSCRIPTION_INACTIVE" : "LIMIT_REACHED",
        metric,
        limit,
        used,
        message:
          reason === "read_only"
            ? "Your trial or subscription is not active. Choose a plan to continue. Your data is safe and messages you already approved still send."
            : `You reached your plan's limit for ${metric} (${used}/${limit}). Upgrade to continue.`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

export function periodKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type Metric = "draft" | "scrape" | "message_sent";
const CACHE_MS = 10_000;

/**
 * Plan limits and monthly usage. The numbers come from the entitlement provider; with the Community provider
 * everything is unlimited and nothing is counted. Usage counters are stored here because they are useful to anyone.
 */
@Injectable()
export class LimitsService {
  private readonly cache = new Map<string, { at: number; value: EntitlementSnapshot }>();

  constructor(private readonly prisma: PrismaService, @Inject(ENTITLEMENT_PROVIDER) private readonly provider: EntitlementProvider) {}

  get enabled(): boolean {
    return this.provider.enforcing;
  }

  async ownerOf(workspaceId: string): Promise<string | null> {
    const m = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, role: "owner" }, orderBy: { createdAt: "asc" }, select: { userId: true } });
    return m?.userId ?? null;
  }

  /** What the workspace owner's plan allows right now. */
  async snapshotFor(workspaceId: string): Promise<EntitlementSnapshot> {
    const hit = this.cache.get(workspaceId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const ownerId = await this.ownerOf(workspaceId);
    const value = await this.provider.snapshotForUser(ownerId ?? "");
    if (this.cache.size > 2000) this.cache.clear();
    this.cache.set(workspaceId, { at: Date.now(), value });
    return value;
  }

  snapshotForUser(userId: string): Promise<EntitlementSnapshot> {
    return this.provider.snapshotForUser(userId);
  }

  forgetAll(): void {
    this.cache.clear();
  }

  /** This month's usage across every workspace the owner has (limits belong to the account). */
  async usageForOwner(ownerId: string, now = new Date()) {
    const owned = await this.prisma.workspaceMember.findMany({ where: { userId: ownerId, role: "owner" }, select: { workspaceId: true } });
    const ids = owned.map((o) => o.workspaceId);
    const rows = await this.prisma.usageCounter.groupBy({ by: ["metric"], where: { workspaceId: { in: ids }, period: periodKey(now) }, _sum: { count: true } });
    const by = Object.fromEntries(rows.map((r) => [r.metric, r._sum.count ?? 0])) as Record<string, number>;
    return { workspaces: ids.length, drafts: by.draft ?? 0, scrapes: by.scrape ?? 0, messagesSent: by.message_sent ?? 0 };
  }

  async assertCan(workspaceId: string, metric: "draft" | "scrape"): Promise<void> {
    if (!this.enabled) return;
    const snap = await this.snapshotFor(workspaceId);
    if (snap.readOnly) throw new LimitReachedException(metric, 0, 0, "read_only");
    if (metric !== "draft") return;
    const ownerId = await this.ownerOf(workspaceId);
    if (!ownerId) return;
    const used = (await this.usageForOwner(ownerId)).drafts;
    if (used >= snap.limits.draftsPerMonth) throw new LimitReachedException("drafts", snap.limits.draftsPerMonth, used, "limit");
  }

  async draftsLeft(workspaceId: string): Promise<number> {
    if (!this.enabled) return Infinity;
    const snap = await this.snapshotFor(workspaceId);
    if (snap.readOnly) return 0;
    const ownerId = await this.ownerOf(workspaceId);
    if (!ownerId) return 0;
    return Math.max(0, snap.limits.draftsPerMonth - (await this.usageForOwner(ownerId)).drafts);
  }

  async assertCanCreateWorkspace(userId: string): Promise<void> {
    if (!this.enabled) return;
    const snap = await this.provider.snapshotForUser(userId);
    const used = await this.prisma.workspaceMember.count({ where: { userId, role: "owner" } });
    if (snap.readOnly) throw new LimitReachedException("workspaces", 0, used, "read_only");
    if (used >= snap.limits.workspaces) throw new LimitReachedException("workspaces", snap.limits.workspaces, used, "limit");
  }

  async assertCanAddMember(workspaceId: string): Promise<void> {
    if (!this.enabled) return;
    const snap = await this.snapshotFor(workspaceId);
    const used = await this.prisma.workspaceMember.count({ where: { workspaceId } });
    if (snap.readOnly) throw new LimitReachedException("members", 0, used, "read_only");
    if (used >= snap.limits.membersPerWorkspace) throw new LimitReachedException("members", snap.limits.membersPerWorkspace, used, "limit");
  }

  /** Adds to this month's counter. Never throws: counting must not break the work it counts. */
  async record(workspaceId: string, metric: Metric, n = 1): Promise<void> {
    if (!this.enabled || n <= 0) return;
    try {
      const period = periodKey(new Date());
      await this.prisma.usageCounter.upsert({
        where: { workspaceId_period_metric: { workspaceId, period, metric } },
        create: { workspaceId, period, metric, count: n },
        update: { count: { increment: n } },
      });
    } catch {
      /* a lost count is better than a failed draft */
    }
  }
}
