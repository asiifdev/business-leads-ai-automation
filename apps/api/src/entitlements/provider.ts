/**
 * The contract between this open-source repository and a commercial entitlement provider.
 *
 * This repository knows the *vocabulary* (feature keys, limit keys) and asks "may this workspace do X?". The answer comes
 * from a provider. With none installed, the Community provider answers "everything here, no limits". The commercial
 * provider (plans, prices, subscriptions, licence keys, payments) is a separate private package; see `plugin.ts`.
 */
import type { Feature } from "./entitlements";

export interface PlanLimits {
  workspaces: number;
  membersPerWorkspace: number;
  draftsPerMonth: number;
}

/** What one account (the workspace owner) may do right now. Values come from the provider, never from this repository. */
export interface EntitlementSnapshot {
  /** Display id of the plan, e.g. "pro", "trial", or "community". */
  plan: string;
  /** "none" when the account has no plan at all. Otherwise a provider-defined status such as trialing, active, past_due. */
  status: string;
  /** No new AI drafts, campaigns, workspaces or members. Already approved messages still send and data stays readable. */
  readOnly: boolean;
  endsAt: Date | null;
  features: Feature[];
  limits: PlanLimits;
}

export const UNLIMITED: PlanLimits = { workspaces: Infinity, membersPerWorkspace: Infinity, draftsPerMonth: Infinity };

export interface EntitlementProvider {
  readonly name: string;
  /** True when plans are enforced (a commercial provider is installed). Community returns false. */
  readonly enforcing: boolean;
  snapshotForUser(userId: string): Promise<EntitlementSnapshot>;
  /** Called once after a new account is created (a hosted provider starts the free trial here). */
  onUserRegistered?(userId: string): Promise<void>;
}

export const ENTITLEMENT_PROVIDER = Symbol("ENTITLEMENT_PROVIDER");

/** The open-source edition: every feature in this repository, no limits, nothing tracked remotely. */
export class CommunityProvider implements EntitlementProvider {
  readonly name = "community";
  readonly enforcing = false;
  async snapshotForUser(): Promise<EntitlementSnapshot> {
    return { plan: "community", status: "active", readOnly: false, endsAt: null, features: [], limits: UNLIMITED };
  }
}
