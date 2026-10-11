import type { RequestHandler } from "express";
import type { LicenseProvider } from "./license.provider";
import type { EntitlementProvider } from "./provider";

export const CLOUD_HOST = Symbol("CLOUD_HOST");

export interface CloudHost {
  provider: EntitlementProvider;
  /** Routes from the commercial package (hosted only), mounted at /api/billing. */
  router: RequestHandler | null;
  /** Present on self-hosted installs: the client for licence keys. Null when subscriptions manage entitlements. */
  license: LicenseProvider | null;
}
