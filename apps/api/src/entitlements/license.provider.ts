import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PrismaService } from "../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../settings/encryption.util";
import type { Feature } from "./entitlements";
import { docState, verifyDoc, type DocState, type EntitlementDoc, type SignedDoc } from "./license-doc";
import { LICENSE_PUBLIC_KEY } from "./license-public-key";
import { UNLIMITED, type EntitlementProvider, type EntitlementSnapshot } from "./provider";

const DEFAULT_SERVER = "https://api.alatpintar.id";
const REFRESH_MS = 24 * 3_600_000;
const KEY_RE = /^ap_[A-Z2-7]{32}$/;

export interface LicenseStatus {
  hasKey: boolean;
  source: "env" | "stored" | null;
  tier: string | null;
  features: Feature[];
  /** none: no licence. fresh/grace: features on. expired: features off (back to Community). */
  state: DocState | "none";
  validUntil: string | null;
  graceUntil: string | null;
  expiresAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  server: string;
}

export class LicenseError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface LicenseProviderOptions {
  encryptionKey: string;
  envKey?: string;
  server?: string;
  version?: string;
  publicKeyPem?: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

/**
 * Self-hosted licensing, client side. A key is exchanged with the licence server for a signed document that is bound to
 * this install. The signature is verified here with a public key, so there is nothing secret in this file. Nothing is
 * sent unless a key is configured. What is sent: the key, a random install id and the app version. No content, no data.
 * Features switch on while the document is fresh, stay on for a 14-day offline grace, then fall back to Community.
 */
export class LicenseProvider implements EntitlementProvider {
  readonly name = "alatpintar-license";
  /** Self-hosted installs have no plan limits; the licence only unlocks features. */
  readonly enforcing = false;
  private readonly logger = new Logger("License");
  private readonly server: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly publicKey: string;
  private instanceId = "";
  private doc: EntitlementDoc | null = null;
  private key: { value: string; source: "env" | "stored" } | null = null;
  private lastCheckedAt: Date | null = null;
  private lastError: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService, private readonly opts: LicenseProviderOptions) {
    this.server = (opts.server || DEFAULT_SERVER).replace(/\/+$/, "");
    this.fetchFn = opts.fetchFn ?? fetch;
    this.now = opts.now ?? (() => new Date());
    this.publicKey = opts.publicKeyPem ?? LICENSE_PUBLIC_KEY;
  }

  private async get(key: string): Promise<string | null> {
    return (await this.prisma.instanceSetting.findUnique({ where: { key } }))?.value ?? null;
  }
  private async put(key: string, value: string): Promise<void> {
    await this.prisma.instanceSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  /** Loads the install id, the key and the last document, then refreshes in the background and once a day. */
  async init(): Promise<void> {
    this.instanceId = (await this.get("instance_id")) ?? "";
    if (!this.instanceId) {
      this.instanceId = randomUUID();
      await this.put("instance_id", this.instanceId);
    }
    const stored = await this.get("license_key");
    if (stored) {
      try {
        this.key = { value: decryptSecret(stored, this.opts.encryptionKey), source: "stored" };
      } catch {
        this.logger.warn("The stored licence key could not be decrypted (ENCRYPTION_KEY changed?). Enter it again.");
      }
    }
    if (!this.key && this.opts.envKey && KEY_RE.test(this.opts.envKey.trim())) this.key = { value: this.opts.envKey.trim(), source: "env" };
    const cached = await this.get("license_doc");
    if (cached) this.doc = this.accept(JSON.parse(cached) as SignedDoc);
    if (this.key) {
      void this.refresh();
      this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Accepts a document only if the signature is valid and it is bound to this install. */
  private accept(signed: SignedDoc): EntitlementDoc | null {
    const doc = verifyDoc(signed, this.publicKey);
    return doc && doc.instanceId === this.instanceId ? doc : null;
  }

  private state(): DocState | "none" {
    return this.doc ? docState(this.doc, this.now(), this.instanceId) : "none";
  }

  async snapshotForUser(): Promise<EntitlementSnapshot> {
    const st = this.state();
    if (!this.doc || st === "none" || st === "expired") {
      return { plan: "community", status: "active", readOnly: false, endsAt: null, features: [], limits: UNLIMITED };
    }
    return { plan: this.doc.tier, status: st === "grace" ? "offline_grace" : "active", readOnly: false, endsAt: this.doc.expiresAt ? new Date(this.doc.expiresAt) : null, features: this.doc.features, limits: UNLIMITED };
  }

  /** Asks the server for a fresh document. A network failure keeps the cached one; a rejected key removes it. */
  async refresh(): Promise<void> {
    if (!this.key) return;
    try {
      const res = await this.fetchFn(`${this.server}/v1/license/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: this.key.value, instanceId: this.instanceId, version: this.opts.version ?? "dev" }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as SignedDoc & { message?: string; code?: string };
      this.lastCheckedAt = this.now();
      if (res.status === 403 || res.status === 400) {
        // The key itself is refused (revoked, expired, malformed): do not keep granting features.
        this.doc = null;
        await this.prisma.instanceSetting.deleteMany({ where: { key: "license_doc" } });
        this.lastError = body.message ?? "The licence key was refused";
        return;
      }
      if (!res.ok) throw new Error(`licence server answered ${res.status}`);
      const doc = this.accept(body);
      if (!doc) throw new Error("the licence server's answer could not be verified");
      this.doc = doc;
      this.lastError = null;
      await this.put("license_doc", JSON.stringify({ payload: body.payload, signature: body.signature }));
    } catch (e) {
      this.lastError = (e as Error).message;
      this.logger.warn(`Licence refresh failed: ${this.lastError}. Using the saved document until it ends.`);
    }
  }

  /** Saves a key after the server accepts it. */
  async setKey(raw: string): Promise<LicenseStatus> {
    const key = raw.trim();
    if (!KEY_RE.test(key)) throw new LicenseError("That does not look like an alatpintar.id licence key (ap_ followed by 32 characters).");
    const prev = { key: this.key, doc: this.doc };
    this.key = { value: key, source: "stored" };
    await this.refresh();
    if (!this.doc) {
      const msg = this.lastError ?? "The licence key was not accepted";
      this.key = prev.key;
      this.doc = prev.doc;
      throw new LicenseError(msg, 400);
    }
    await this.put("license_key", encryptSecret(key, this.opts.encryptionKey));
    if (!this.timer) {
      this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
      this.timer.unref();
    }
    return this.status();
  }

  async clearKey(): Promise<void> {
    this.key = null;
    this.doc = null;
    this.lastError = null;
    await this.prisma.instanceSetting.deleteMany({ where: { key: { in: ["license_key", "license_doc"] } } });
    this.stop();
    this.timer = null;
  }

  /** Free "registered" key by email. The server emails it; nothing comes back here. */
  async requestFreeKey(email: string): Promise<void> {
    const res = await this.fetchFn(`${this.server}/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!res) throw new LicenseError("Could not reach the licence server. Try again later.", 503);
    if (res.status === 400) throw new LicenseError("Enter a valid email address.");
    if (res.status === 429) throw new LicenseError("Too many requests. Try again later.", 429);
    if (!res.ok) throw new LicenseError("Registration is not available right now.", 503);
  }

  status(): LicenseStatus {
    return {
      hasKey: !!this.key,
      source: this.key?.source ?? null,
      tier: this.doc?.tier ?? null,
      features: this.state() === "expired" ? [] : this.doc?.features ?? [],
      state: this.state(),
      validUntil: this.doc?.validUntil ?? null,
      graceUntil: this.doc?.graceUntil ?? null,
      expiresAt: this.doc?.expiresAt ?? null,
      lastCheckedAt: this.lastCheckedAt?.toISOString() ?? null,
      lastError: this.lastError,
      server: this.server,
    };
  }
}
