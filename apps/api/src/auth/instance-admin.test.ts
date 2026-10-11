import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInstanceAdmin, isInstanceAdmin } from "./instance-admin";

/** A tiny prisma: the oldest user and an instance_settings table. */
const prisma = (firstId: string | null, saved?: string) => {
  const rows = new Map<string, string>(saved ? [["instance_admin_id", saved]] : []);
  return {
    rows,
    user: { findFirst: async () => (firstId ? { id: firstId } : null) },
    instanceSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => (rows.has(where.key) ? { value: rows.get(where.key) } : null),
      createMany: async ({ data }: { data: { key: string; value: string }[] }) => void data.forEach((d) => !rows.has(d.key) && rows.set(d.key, d.value)),
    },
  } as never;
};
const cfg = (ids?: string) => ({ get: (k: string) => (k === "PLATFORM_ADMIN_USER_IDS" ? ids : undefined) }) as never;

test("without a configured list, only the first account on the install is the admin", async () => {
  assert.equal(await isInstanceAdmin(prisma("u1"), cfg(), "u1"), true);
  assert.equal(await isInstanceAdmin(prisma("u1"), cfg(), "u2"), false); // a later sign-up owns only their own workspace
});

test("a configured list replaces the first-account rule", async () => {
  assert.equal(await isInstanceAdmin(prisma("u1"), cfg("u7, u8"), "u8"), true);
  assert.equal(await isInstanceAdmin(prisma("u1"), cfg("u7, u8"), "u1"), false);
});

test("a missing user is never an admin, and assert throws 403", async () => {
  assert.equal(await isInstanceAdmin(prisma("u1"), cfg(), undefined), false);
  assert.equal(await isInstanceAdmin(prisma(null), cfg(), "u1"), false);
  await assert.rejects(assertInstanceAdmin(prisma("u1"), cfg(), "u2"), /administrator/);
});

test("the first admin is remembered: removing or re-ordering accounts cannot pass the role on", async () => {
  const db = prisma("u1") as unknown as { rows: Map<string, string>; user: { findFirst: () => Promise<{ id: string } | null> } };
  assert.equal(await isInstanceAdmin(db as never, cfg(), "u1"), true);
  assert.equal(db.rows.get("instance_admin_id"), "u1");
  db.user.findFirst = async () => ({ id: "u2" }); // u1 was deleted: u2 is now the oldest account
  assert.equal(await isInstanceAdmin(db as never, cfg(), "u2"), false);
  assert.equal(await isInstanceAdmin(db as never, cfg(), "u1"), true);
});

test("an already saved admin wins over whoever is oldest", async () => {
  assert.equal(await isInstanceAdmin(prisma("u1", "u9"), cfg(), "u1"), false);
  assert.equal(await isInstanceAdmin(prisma("u1", "u9"), cfg(), "u9"), true);
});
