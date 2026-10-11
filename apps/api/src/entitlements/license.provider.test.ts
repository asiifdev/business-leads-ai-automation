import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { LicenseError, LicenseProvider } from "./license.provider";
import type { EntitlementDoc } from "./license-doc";

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { pub: publicKey.export({ type: "spki", format: "pem" }).toString(), priv: privateKey };
};
const real = pair();
const forger = pair();
const KEY = "ap_" + "A".repeat(32);
const ENC = randomBytes(32).toString("base64");

const signedBy = (priv: typeof real.priv, doc: EntitlementDoc) => {
  const payload = Buffer.from(JSON.stringify(doc));
  return { payload: payload.toString("base64"), signature: sign(null, payload, priv).toString("base64") };
};

function fakePrisma() {
  const rows = new Map<string, string>();
  return {
    rows,
    instanceSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => (rows.has(where.key) ? { value: rows.get(where.key) } : null),
      upsert: async ({ where, create }: { where: { key: string }; create: { value: string } }) => void rows.set(where.key, create.value),
      deleteMany: async ({ where }: { where: { key: string | { in: string[] } } }) => {
        for (const k of typeof where.key === "string" ? [where.key] : where.key.in) rows.delete(k);
      },
    },
  };
}

/** A fake licence server that answers with a document for the instance id it is sent. */
function server(opts: { priv?: typeof real.priv; status?: number; features?: EntitlementDoc["features"]; tier?: string; expiresAt?: string | null; fail?: boolean } = {}) {
  const calls: unknown[] = [];
  const fn = (async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body));
    if (opts.fail) throw new Error("network down");
    const { instanceId } = JSON.parse(init.body);
    if (opts.status && opts.status >= 400) return new Response(JSON.stringify({ message: "licence key is not valid" }), { status: opts.status });
    const t = Date.now();
    const doc: EntitlementDoc = {
      v: 1, licenseId: "l", tier: opts.tier ?? "plus", features: opts.features ?? ["whatsapp.cloud_api"], instanceId,
      issuedAt: new Date(t).toISOString(), validUntil: new Date(t + 48 * 3_600_000).toISOString(), graceUntil: new Date(t + 14 * 86_400_000).toISOString(), expiresAt: opts.expiresAt ?? null,
    };
    return new Response(JSON.stringify(signedBy(opts.priv ?? real.priv, doc)), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const make = async (srv: ReturnType<typeof server>, over: Partial<ConstructorParameters<typeof LicenseProvider>[1]> = {}, prisma = fakePrisma(), now?: () => Date) => {
  const p = new LicenseProvider(prisma as never, { encryptionKey: ENC, publicKeyPem: real.pub, fetchFn: srv.fn, now, ...over });
  await p.init();
  return { p, prisma };
};

test("with no key it is Community and sends nothing to anyone", async () => {
  const srv = server();
  const { p } = await make(srv);
  assert.deepEqual((await p.snapshotForUser()).features, []);
  assert.equal(p.status().state, "none");
  assert.equal(srv.calls.length, 0);
  p.stop();
});

test("a valid key unlocks the tier's features and is stored encrypted", async () => {
  const { p, prisma } = await make(server());
  const st = await p.setKey(KEY);
  assert.equal(st.state, "fresh");
  assert.equal(st.tier, "plus");
  assert.deepEqual((await p.snapshotForUser()).features, ["whatsapp.cloud_api"]);
  assert.ok(!prisma.rows.get("license_key")!.includes(KEY));
  p.stop();
});

test("only the key, an install id and the version are sent", async () => {
  const srv = server();
  const { p } = await make(srv, { version: "9.9.9" });
  await p.setKey(KEY);
  assert.deepEqual(Object.keys(srv.calls[0] as object).sort(), ["instanceId", "key", "version"]);
  p.stop();
});

test("a malformed key is refused without calling the server", async () => {
  const srv = server();
  const { p } = await make(srv);
  await assert.rejects(p.setKey("sk-nope"), LicenseError);
  assert.equal(srv.calls.length, 0);
  p.stop();
});

test("a document signed with any other key is rejected", async () => {
  const { p } = await make(server({ priv: forger.priv }));
  await assert.rejects(p.setKey(KEY), /could not be verified/);
  assert.deepEqual((await p.snapshotForUser()).features, []);
  p.stop();
});

test("a refused key (revoked or expired) is not saved and grants nothing", async () => {
  const { p, prisma } = await make(server({ status: 403 }));
  await assert.rejects(p.setKey(KEY), /not valid/);
  assert.equal(prisma.rows.has("license_key"), false);
  assert.deepEqual((await p.snapshotForUser()).features, []);
  p.stop();
});

test("offline: the saved document keeps working through the grace period, then ends", async () => {
  const prisma = fakePrisma();
  let t = Date.now();
  const first = await make(server(), {}, prisma, () => new Date(t));
  await first.p.setKey(KEY);
  first.p.stop();
  // restart with the server unreachable
  const down = server({ fail: true });
  t += 5 * 86_400_000; // 5 days: past "fresh", inside the 14-day grace
  const second = await make(down, {}, prisma, () => new Date(t));
  await second.p.refresh();
  assert.equal(second.p.status().state, "grace");
  assert.deepEqual((await second.p.snapshotForUser()).features, ["whatsapp.cloud_api"]);
  t += 12 * 86_400_000; // past grace
  assert.equal(second.p.status().state, "expired");
  assert.deepEqual((await second.p.snapshotForUser()).features, []);
  second.p.stop();
});

test("when the server later refuses the key, features switch off", async () => {
  const prisma = fakePrisma();
  const a = await make(server(), {}, prisma);
  await a.p.setKey(KEY);
  a.p.stop();
  const b = await make(server({ status: 403 }), {}, prisma);
  await b.p.refresh();
  assert.deepEqual((await b.p.snapshotForUser()).features, []);
  assert.equal(b.p.status().lastError, "licence key is not valid");
  b.p.stop();
});

test("a document copied from another install is ignored", async () => {
  const a = fakePrisma();
  const first = await make(server(), {}, a);
  await first.p.setKey(KEY);
  first.p.stop();
  const b = fakePrisma();
  b.rows.set("license_doc", a.rows.get("license_doc")!); // someone copies the saved document to a different install
  const other = await make(server({ fail: true }), {}, b);
  assert.deepEqual((await other.p.snapshotForUser()).features, []);
  other.p.stop();
});

test("clearing the key removes the features and the saved data", async () => {
  const { p, prisma } = await make(server());
  await p.setKey(KEY);
  await p.clearKey();
  assert.deepEqual((await p.snapshotForUser()).features, []);
  assert.equal(prisma.rows.has("license_key"), false);
  assert.equal(prisma.rows.has("license_doc"), false);
});

test("a key from the environment is used when none is stored", async () => {
  const srv = server();
  const { p } = await make(srv, { envKey: KEY });
  await p.refresh();
  assert.equal(p.status().source, "env");
  assert.equal(p.status().state, "fresh");
  p.stop();
});
