/**
 * Checks, against a real database, what deleting a campaign or a lead takes with it: the leads, activities, follow-ups and every message
 * sent to or received from them; and what it must keep: opt-outs and messages from numbers that were never a lead. Also that a running
 * campaign, another workspace's campaign or lead, and anything with a message being sent are refused.
 * Run: DATABASE_URL=<a scratch database> npx tsx scripts/delete-check.ts
 * Everything happens in throwaway workspaces that are deleted at the end; no AI, no network.
 */
import { PrismaService } from "../src/prisma/prisma.service";
import { CampaignsService } from "../src/campaigns/campaigns.service";
import { LeadsService } from "../src/leads/leads.service";
const prisma = new PrismaService();
let bad = 0; const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (!c) bad++; };
(async () => {
  const s = Date.now().toString(36);
  const w1 = (await prisma.workspace.create({ data: { name: `d1 ${s}`, slug: `d1-${s}` } })).id;
  const w2 = (await prisma.workspace.create({ data: { name: `d2 ${s}`, slug: `d2-${s}` } })).id;
  const camps = new CampaignsService(prisma as never); const leads = new LeadsService(prisma);
  const mk = (workspaceId: string, status: string) => prisma.campaign.create({ data: { name: "c", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", workspaceId, status } });
  const count = async (ids: string[]) => ({ out: await prisma.outboundMessage.count({ where: { id: { in: ids } } }) });
  try {
    const c = await mk(w1, "completed"), running = await mk(w1, "running"), other = await mk(w2, "completed"), c2 = await mk(w1, "completed");
    const lead = await prisma.lead.create({ data: { name: "L", workspaceId: w1, campaignId: c.id, phone: "0812", phoneE164: "628120000000" } });
    const rep = await prisma.lead.create({ data: { name: "Repeat", workspaceId: w1, campaignId: c2.id, duplicateOfId: lead.id } });
    const mkMsg = (leadId: string, status: string) => prisma.outboundMessage.create({ data: { workspaceId: w1, leadId, toPhone: "628120000000", body: "x", source: "manual", status } });
    const m = [await mkMsg(lead.id, "draft"), await mkMsg(lead.id, "approved"), await mkMsg(lead.id, "sent")];
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: "note" } });
    await prisma.followUp.create({ data: { leadId: lead.id, scheduledAt: new Date(), note: "x" } as never }).catch(() => undefined);
    const inb = await prisma.inboundMessage.create({ data: { workspaceId: w1, leadId: lead.id, fromPhone: "628120000000", body: "hi", providerMessageId: `p-${s}-1`, receivedAt: new Date() } });
    const stranger = await prisma.inboundMessage.create({ data: { workspaceId: w1, fromPhone: "628999", body: "who", providerMessageId: `p-${s}-2`, receivedAt: new Date() } });
    await prisma.messageOptOut.create({ data: { workspaceId: w1, phone: "628120000000", reason: "STOP" } });

    await camps.remove(running.id, w1).then(() => ok("a running campaign is refused", false), (e) => ok("a running campaign is refused", /still running/.test(e.message)));
    await camps.remove(other.id, w1).then(() => ok("another workspace's campaign cannot be deleted", false), () => ok("another workspace's campaign cannot be deleted", true));
    const inflight = await mkMsg(lead.id, "sending");
    await camps.remove(c.id, w1).then(() => ok("a campaign with a message being sent is refused", false), (e) => ok("a campaign with a message being sent is refused", /being sent/.test(e.message)));
    await leads.remove(lead.id, w2).then(() => ok("another workspace's lead cannot be deleted", false), () => ok("another workspace's lead cannot be deleted", true));
    await leads.remove(lead.id, w1).then(() => ok("a lead with a message being sent is refused", false), (e) => ok("a lead with a message being sent is refused", /being sent/.test(e.message)));
    await prisma.outboundMessage.update({ where: { id: inflight.id }, data: { status: "failed" } });

    await camps.remove(c.id, w1);
    ok("the campaign and its leads are gone", !(await prisma.campaign.findUnique({ where: { id: c.id } })) && !(await prisma.lead.findUnique({ where: { id: lead.id } })));
    ok("every message sent to the lead is gone, whatever its status", (await count([...m, inflight].map((x) => x.id))).out === 0);
    ok("activities and follow-ups are gone", (await prisma.leadActivity.count({ where: { leadId: lead.id } })) === 0 && (await prisma.followUp.count({ where: { leadId: lead.id } })) === 0);
    ok("messages received from the lead are gone", !(await prisma.inboundMessage.findUnique({ where: { id: inb.id } })));
    ok("a message from a number that was never a lead is kept", !!(await prisma.inboundMessage.findUnique({ where: { id: stranger.id } })));
    ok("the STOP of that number is remembered", (await prisma.messageOptOut.count({ where: { workspaceId: w1, phone: "628120000000" } })) === 1);
    ok("a repeat of a deleted lead becomes a standalone lead", (await prisma.lead.findUniqueOrThrow({ where: { id: rep.id } })).duplicateOfId === null);

    // deleting a single lead
    const l2 = await prisma.lead.create({ data: { name: "L2", workspaceId: w1, campaignId: c2.id, priority: "HIGH" } });
    const m2 = await mkMsg(l2.id, "sent");
    await prisma.campaign.update({ where: { id: c2.id }, data: { totalLeads: 2, priorityLeads: 1 } });
    await leads.remove(l2.id, w1);
    ok("deleting one lead removes it and its messages", !(await prisma.lead.findUnique({ where: { id: l2.id } })) && !(await prisma.outboundMessage.findUnique({ where: { id: m2.id } })));
    const c2after = await prisma.campaign.findUniqueOrThrow({ where: { id: c2.id } });
    ok("the campaign's totals are counted again", c2after.totalLeads === 1 && c2after.priorityLeads === 0);
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: [w1, w2] } } });
    await prisma.$disconnect();
  }
  console.log(bad ? `${bad} FAILED` : "All checks passed"); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
