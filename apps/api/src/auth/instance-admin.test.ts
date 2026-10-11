import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInstanceAdmin, isInstanceAdmin } from "./instance-admin";

const prisma = (firstId: string | null) => ({ user: { findFirst: async () => (firstId ? { id: firstId } : null) } }) as never;
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
