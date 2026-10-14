import { test } from "node:test";
import assert from "node:assert/strict";
import { fillTemplate } from "./template.service";

test("fillTemplate substitutes only {nama} and {kategori}", () => {
  assert.equal(fillTemplate("Halo {nama}, untuk {kategori}", { name: " Griya Kebaya ", category: "Sewa kebaya" }), "Halo Griya Kebaya, untuk Sewa kebaya");
  assert.equal(fillTemplate("{NAMA} {lain}", { name: "A" }), "A {lain}");
  assert.equal(fillTemplate("tanpa placeholder", { name: "A" }), "tanpa placeholder");
});

import { TemplateService } from "./template.service";

function fakePrisma(created: unknown[]) {
  const leads = [
    { id: "a", name: "Griya Kebaya", category: "Sewa kebaya", phone: "0812-3456-789", phoneE164: null, email: null },
    { id: "b", name: "Tanpa Nomor", category: "Sewa kebaya", phone: null, phoneE164: null, email: null },
    { id: "c", name: "Sudah Berhenti", category: "Sewa kebaya", phone: "0813-0000-111", phoneE164: "628130000111", email: null },
    { id: "d", name: "Sudah Dikirimi", category: "Sewa kebaya", phone: "0814-0000-222", phoneE164: "628140000222", email: null },
    { id: "e", name: "Nomor Sama", category: "Sewa kebaya", phone: "0812-3456-789", phoneE164: null, email: null },
  ];
  return {
    lead: { findMany: async () => leads, update: async () => ({}) },
    whatsappAccount: { findUnique: async () => ({ defaultCountryCode: "62" }) },
    messageOptOut: { findMany: async () => [{ phone: "628130000111" }] },
    emailOptOut: { findMany: async () => [] },
    outboundMessage: { findMany: async () => [{ toPhone: "628140000222", toEmail: null, leadId: "d" }], createMany: async ({ data }: { data: unknown[] }) => { created.push(...data); } },
  };
}

test("apply makes one draft per reachable lead and counts the rest", async () => {
  const created: any[] = [];
  const svc = new TemplateService(fakePrisma(created) as never, {} as never, {} as never);
  const r = await svc.apply("ws", { channel: "whatsapp", leadIds: ["a", "b", "c", "d", "e"], body: "Halo {nama}, untuk {kategori}." });
  assert.deepEqual(r.skipped, { noContact: 1, optedOut: 1, alreadyMessaged: 2 });
  assert.equal(r.created, 1);
  assert.equal(created[0].toPhone, "628123456789");
  assert.match(created[0].body, /^Halo Griya Kebaya, untuk Sewa kebaya\.\n\nKalau tidak berkenan, balas STOP\.$/);
  assert.equal(created[0].status, "draft");
  assert.equal(created[0].source, "ai_outreach");
});

test("apply refuses an empty message and an email without subject", async () => {
  const svc = new TemplateService(fakePrisma([]) as never, {} as never, {} as never);
  await assert.rejects(() => svc.apply("ws", { channel: "whatsapp", leadIds: ["a"], body: "  " }));
  await assert.rejects(() => svc.apply("ws", { channel: "email", leadIds: ["a"], body: "Isi" }));
});
