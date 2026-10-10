import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { featuresFor, parseEdition } from "./entitlements";
import { EntitlementsService, UpgradeRequiredException } from "./entitlements.service";
import { loadCloudProvider } from "../messaging/cloud-plugin";
import { WhatsappGateway } from "../messaging/whatsapp.gateway";
import { ProviderUnavailableError } from "../messaging/whatsapp.provider";

const cfg = (edition?: string) => ({ get: (k: string) => (k === "EDITION" ? edition : undefined) }) as never;
const prismaWithPlan = (plan: string) => ({ workspace: { findUnique: async () => ({ plan }) }, whatsappAccount: { findMany: async () => [] } }) as never;

test("the community edition has no commercial features, whatever the plan says", () => {
  for (const plan of ["free", "pro", "business", "starter", undefined]) {
    const f = featuresFor("community", plan);
    assert.equal(f["whatsapp.cloud_api"], false);
    assert.equal(f["ai.managed"], false);
  }
});

test("the hosted edition grants features by plan; unknown plans get nothing", () => {
  assert.deepEqual(featuresFor("hosted", "starter"), { "whatsapp.cloud_api": false, "ai.managed": true });
  assert.deepEqual(featuresFor("hosted", "PRO"), { "whatsapp.cloud_api": true, "ai.managed": true });
  assert.deepEqual(featuresFor("hosted", "business"), { "whatsapp.cloud_api": true, "ai.managed": true });
  assert.deepEqual(featuresFor("hosted", "free"), { "whatsapp.cloud_api": false, "ai.managed": false });
  assert.deepEqual(featuresFor("hosted", "nonsense"), { "whatsapp.cloud_api": false, "ai.managed": false });
});

test("anything but 'hosted' means community (a typo cannot unlock features)", () => {
  assert.equal(parseEdition("hosted"), "hosted");
  for (const v of [undefined, "", "Hosted ", "enterprise", "true", "community"]) assert.equal(parseEdition(v), "community");
});

test("assert throws a 402 UPGRADE_REQUIRED with a clear message per edition", async () => {
  const community = new EntitlementsService(cfg(), prismaWithPlan("pro"));
  await assert.rejects(community.assert("w", "whatsapp.cloud_api"), (e: UpgradeRequiredException) => {
    const body = e.getResponse() as { code: string; message: string };
    return e.getStatus() === 402 && body.code === "UPGRADE_REQUIRED" && /alatpintar\.id/.test(body.message);
  });
  const hostedStarter = new EntitlementsService(cfg("hosted"), prismaWithPlan("starter"));
  await assert.rejects(hostedStarter.assert("w", "whatsapp.cloud_api"), /does not include|402|UPGRADE/i);
  await assert.doesNotReject(new EntitlementsService(cfg("hosted"), prismaWithPlan("pro")).assert("w", "whatsapp.cloud_api"));
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
