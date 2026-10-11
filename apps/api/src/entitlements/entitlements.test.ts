import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEdition } from "./entitlements";
import { EntitlementsService, UpgradeRequiredException } from "./entitlements.service";
import { loadCloudPlugin } from "./plugin";
import { CommunityProvider, UNLIMITED } from "./provider";
import { loadCloudProvider } from "../messaging/cloud-plugin";
import { WhatsappGateway } from "../messaging/whatsapp.gateway";
import { ProviderUnavailableError } from "../messaging/whatsapp.provider";

const cfg = (edition?: string) => ({ get: (k: string) => (k === "EDITION" ? edition : undefined) }) as never;
/** A limits service whose owner has the given features. */
const limitsWith = (features: string[], plan = "x") => ({ snapshotFor: async () => ({ plan, status: "active", readOnly: false, endsAt: null, features, limits: UNLIMITED }), ownerOf: async () => "u", enabled: true, usageForOwner: async () => ({}) }) as never;

test("the community provider grants no commercial features and no limits", async () => {
  const s = await new CommunityProvider().snapshotForUser();
  assert.deepEqual(s.features, []);
  assert.equal(s.limits.draftsPerMonth, Infinity);
  assert.equal(new CommunityProvider().enforcing, false);
});

test("anything but 'hosted' means community (a typo cannot unlock features)", () => {
  assert.equal(parseEdition("hosted"), "hosted");
  for (const v of [undefined, "", "Hosted ", "enterprise", "true", "community"]) assert.equal(parseEdition(v), "community");
});

test("features come from the provider's snapshot, nothing is hard-coded here", async () => {
  const e = new EntitlementsService(cfg("hosted"), limitsWith(["ai.managed"], "pro"));
  assert.equal(await e.has("w", "ai.managed"), true);
  assert.equal(await e.has("w", "whatsapp.cloud_api"), false);
  const l = await e.list("w", "u");
  assert.equal(l.plan, "pro");
  assert.equal(l.isOwner, true);
  assert.equal(l.limits.draftsPerMonth, null); // Infinity is sent as null
});

test("assert throws a 402 UPGRADE_REQUIRED with a clear message per edition", async () => {
  await assert.rejects(new EntitlementsService(cfg(), limitsWith([])).assert("w", "whatsapp.cloud_api"), (e: UpgradeRequiredException) => {
    const body = e.getResponse() as { code: string; message: string };
    return e.getStatus() === 402 && body.code === "UPGRADE_REQUIRED" && /alatpintar\.id/.test(body.message);
  });
  await assert.rejects(new EntitlementsService(cfg("hosted"), limitsWith(["ai.managed"])).assert("w", "whatsapp.cloud_api"), /does not include|402|UPGRADE/i);
  await assert.doesNotReject(new EntitlementsService(cfg("hosted"), limitsWith(["ai.managed", "whatsapp.cloud_api"])).assert("w", "whatsapp.cloud_api"));
});

test("the commercial entitlement package loads only if it exists and exports createProvider", () => {
  assert.equal(loadCloudPlugin("definitely-not-installed-package-xyz"), null);
  const dir = mkdtempSync(join(tmpdir(), "plugin-"));
  const bad = join(dir, "bad.js");
  writeFileSync(bad, "module.exports = { nothing: true };");
  assert.equal(loadCloudPlugin(bad), null);
  const good = join(dir, "good.js");
  writeFileSync(good, "module.exports = { createProvider: () => ({ name: 'x' }) };");
  assert.equal(typeof loadCloudPlugin(good)?.createProvider, "function");
});

test("the cloud connector loads only if the package exists and exports createProvider", () => {
  assert.equal(loadCloudProvider({} as never, "definitely-not-installed-package-xyz"), null);
  const dir = mkdtempSync(join(tmpdir(), "plugin-"));
  const bad = join(dir, "bad.js");
  writeFileSync(bad, "module.exports = { nothing: true };");
  assert.equal(loadCloudProvider({} as never, bad), null);
  const good = join(dir, "good.js");
  writeFileSync(good, "module.exports = { createProvider: () => ({ marker: 'cloud' }) };");
  assert.equal((loadCloudProvider({} as never, good) as unknown as { marker: string }).marker, "cloud");
});

function fakeProvider(name: string) {
  const calls: string[] = [];
  return {
    calls,
    connect: async (w: string) => { calls.push(`${name}.connect(${w})`); },
    disconnect: async () => { calls.push(`${name}.disconnect`); },
    state: () => ({ status: "connected" as const, qr: null, phone: name }),
    resolve: async () => `${name}-jid`,
    send: async () => `${name}-id`,
    onInbound: () => {},
  };
}

test("the gateway routes each workspace to its chosen connection and refuses the cloud one when it is not installed", async () => {
  const baileys = fakeProvider("baileys");
  const gateway = new WhatsappGateway(baileys as never, { whatsappAccount: { findMany: async () => [] } } as never, cfg(), { edition: "community" } as never);
  await gateway.onModuleInit();
  assert.equal(gateway.hasCloud(), false);
  assert.equal(await gateway.send("w1", "x", "hi", 0), "baileys-id");
  gateway.use("w2", "cloud_api");
  assert.equal(gateway.state("w2").status, "disconnected"); // no connector: never silently falls back to the linked device
  await assert.rejects(gateway.send("w2", "x", "hi", 0), ProviderUnavailableError);
  assert.equal(await gateway.send("w1", "x", "hi", 0), "baileys-id");
  assert.deepEqual(baileys.calls, []);
});

test("an unknown connection name means the linked device, never the commercial connector", () => {
  const gateway = new WhatsappGateway(fakeProvider("baileys") as never, {} as never, cfg(), { edition: "community" } as never);
  gateway.use("w", "anything-else");
  assert.equal(gateway.state("w").phone, "baileys");
});
