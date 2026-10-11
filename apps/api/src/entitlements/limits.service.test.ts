import { test } from "node:test";
import assert from "node:assert/strict";
import { LimitReachedException, LimitsService } from "./limits.service";
import { UNLIMITED, type EntitlementProvider, type EntitlementSnapshot } from "./provider";

const provider = (over: Partial<EntitlementSnapshot> = {}, enforcing = true): EntitlementProvider => ({
  name: "test",
  enforcing,
  snapshotForUser: async () => ({ plan: "pro", status: "active", readOnly: false, endsAt: null, features: [], limits: { workspaces: 3, membersPerWorkspace: 3, draftsPerMonth: 2500 }, ...over }),
});

function fakePrisma(opts: { drafts?: number; owned?: number; members?: number } = {}) {
  return {
    workspaceMember: {
      findFirst: async () => ({ userId: "owner" }),
      findMany: async () => Array.from({ length: opts.owned ?? 1 }, (_, i) => ({ workspaceId: `w${i}` })),
      count: async (a: { where: { role?: string } }) => (a.where.role === "owner" ? opts.owned ?? 1 : opts.members ?? 1),
    },
    usageCounter: { groupBy: async () => [{ metric: "draft", _sum: { count: opts.drafts ?? 0 } }], upsert: async () => ({}) },
  } as never;
}

test("with the community provider nothing is limited or counted", async () => {
  const l = new LimitsService(fakePrisma({ drafts: 999999 }), provider({ limits: UNLIMITED }, false));
  await assert.doesNotReject(l.assertCan("w", "draft"));
  await assert.doesNotReject(l.assertCanCreateWorkspace("u"));
  assert.equal(await l.draftsLeft("w"), Infinity);
});

test("a draft is refused at the plan's monthly limit, with a 402 LIMIT_REACHED", async () => {
  await assert.rejects(new LimitsService(fakePrisma({ drafts: 2500 }), provider()).assertCan("w", "draft"), (e: LimitReachedException) => e.getStatus() === 402 && (e.getResponse() as { code: string }).code === "LIMIT_REACHED");
  const ok = new LimitsService(fakePrisma({ drafts: 2499 }), provider());
  await assert.doesNotReject(ok.assertCan("w", "draft"));
  assert.equal(await ok.draftsLeft("w"), 1);
});

test("a read-only account cannot draft or scrape (SUBSCRIPTION_INACTIVE)", async () => {
  const l = new LimitsService(fakePrisma(), provider({ readOnly: true, status: "expired" }));
  for (const m of ["draft", "scrape"] as const) {
    await assert.rejects(l.assertCan("w", m), (e: LimitReachedException) => (e.getResponse() as { code: string }).code === "SUBSCRIPTION_INACTIVE");
  }
  assert.equal(await l.draftsLeft("w"), 0);
});

test("workspaces and members are capped by the provider's limits", async () => {
  const full = new LimitsService(fakePrisma({ owned: 3, members: 3 }), provider());
  await assert.rejects(full.assertCanCreateWorkspace("owner"), LimitReachedException);
  await assert.rejects(full.assertCanAddMember("w"), LimitReachedException);
  const room = new LimitsService(fakePrisma({ owned: 2, members: 2 }), provider());
  await assert.doesNotReject(room.assertCanCreateWorkspace("owner"));
  await assert.doesNotReject(room.assertCanAddMember("w"));
});

test("a scrape is allowed on an active plan regardless of the draft count", async () => {
  await assert.doesNotReject(new LimitsService(fakePrisma({ drafts: 99999 }), provider()).assertCan("w", "scrape"));
});

test("recording a count never throws, even if the database fails", async () => {
  const p = { workspaceMember: {}, usageCounter: { upsert: async () => { throw new Error("db down"); } } } as never;
  await assert.doesNotReject(new LimitsService(p, provider()).record("w", "draft"));
});

/** A prisma whose counter really changes, so the race between parallel drafts is exercised. */
function countingPrisma(start: number) {
  let n = start;
  return {
    get n() { return n; },
    workspaceMember: { findFirst: async () => ({ userId: "owner" }), findMany: async () => [{ workspaceId: "w" }], count: async () => 1 },
    usageCounter: {
      upsert: async ({ update }: { update: { count: { increment: number } } }) => { n += update.count.increment; },
      update: async ({ data }: { data: { count: { decrement: number } } }) => { n -= data.count.decrement; },
      groupBy: async () => [{ metric: "draft", _sum: { count: n } }],
    },
  } as never;
}

test("parallel drafts cannot overshoot the monthly limit", async () => {
  const db = countingPrisma(2498); // limit 2500: two units left
  const l = new LimitsService(db, provider());
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => l.reserveDraft("w")));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.ok(ok <= 2, `at most 2 may pass, ${ok} did`);
  assert.ok((db as unknown as { n: number }).n <= 2500, "the counter never stays above the limit");
});

test("a failed draft is refunded, and a refused one is not charged", async () => {
  const db = countingPrisma(10);
  const l = new LimitsService(db, provider());
  const release = await l.reserveDraft("w");
  assert.equal((db as unknown as { n: number }).n, 11);
  await release();
  assert.equal((db as unknown as { n: number }).n, 10);
  const full = countingPrisma(2500);
  await assert.rejects(new LimitsService(full, provider()).reserveDraft("w"), LimitReachedException);
  assert.equal((full as unknown as { n: number }).n, 2500);
});

test("a read-only account cannot reserve a draft, and the community provider never counts", async () => {
  await assert.rejects(new LimitsService(countingPrisma(0), provider({ readOnly: true, status: "expired" })).reserveDraft("w"), (e: LimitReachedException) => (e.getResponse() as { code: string }).code === "SUBSCRIPTION_INACTIVE");
  const db = countingPrisma(5);
  await (await new LimitsService(db, provider({}, false)).reserveDraft("w"))();
  assert.equal((db as unknown as { n: number }).n, 5);
});

test("the platform's AI key needs an active plan", async () => {
  await assert.rejects(new LimitsService(countingPrisma(0), provider({ readOnly: true })).assertActive("w"), LimitReachedException);
  await assert.doesNotReject(new LimitsService(countingPrisma(0), provider()).assertActive("w"));
  await assert.doesNotReject(new LimitsService(countingPrisma(0), provider({ readOnly: true }, false)).assertActive("w"));
});
