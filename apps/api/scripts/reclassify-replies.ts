/**
 * One-off clean-up: replies like "boleh kak" or "bisa dibuatkan contohnya" that were labelled "other" or "auto_reply"
 * (the rules did not know them, or they came back within seconds and were taken for a shop bot).
 * Re-reads each lead's latest reply against the message we sent before it and, when it is interest or a meeting,
 * fixes the label, marks the lead "needs reply" and moves its stage forward (never backwards, never to won/lost).
 * Run: DATABASE_URL=... npx tsx scripts/reclassify-replies.ts [--apply]   (dry run without --apply)
 */
import { PrismaClient } from "@prisma/client";
import { OPT_OUT_HINT_EN, OPT_OUT_HINT_ID } from "../src/messaging/opt-out";
import { classifyReply, planReplyOutcome } from "../src/messaging/reply-intent";

const WEAK = new Set(["other", "auto_reply", null]);

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  const leads = await prisma.lead.findMany({ where: { repliedAt: { not: null }, crmStatus: { notIn: ["won", "lost"] } }, select: { id: true, name: true, crmStatus: true, workspaceId: true, phoneE164: true, lastIntent: true } });
  let changed = 0;
  for (const l of leads) {
    const inbound = await prisma.inboundMessage.findMany({ where: { workspaceId: l.workspaceId, OR: [{ leadId: l.id }, ...(l.phoneE164 ? [{ fromPhone: l.phoneE164 }] : [])] }, orderBy: { receivedAt: "asc" }, select: { id: true, body: true, intent: true, receivedAt: true } });
    const out = await prisma.outboundMessage.findMany({ where: { leadId: l.id, status: "sent" }, orderBy: { sentAt: "asc" }, select: { body: true, sentAt: true } });
    let best: { id: string; intent: ReturnType<typeof classifyReply>; body: string } | null = null;
    for (const m of inbound) {
      if (!WEAK.has(m.intent)) continue;
      const before = out.filter((o) => o.sentAt && o.sentAt <= m.receivedAt).pop();
      const lastMine = (before?.body ?? "").replace(OPT_OUT_HINT_ID, "").replace(OPT_OUT_HINT_EN, "").trim();
      const intent = classifyReply(m.body, { lastMine });
      if (intent === "interested" || intent === "meeting") best = { id: m.id, intent, body: m.body };
    }
    if (!best || !WEAK.has(l.lastIntent) && l.lastIntent !== "question") continue;
    const outcome = planReplyOutcome(l.crmStatus, best.intent);
    changed++;
    console.log(`${apply ? "fix" : "would fix"}: ${l.name}: "${best.body.slice(0, 50)}" -> ${best.intent}${outcome.stage ? ` (stage ${l.crmStatus} -> ${outcome.stage})` : ""}`);
    if (!apply) continue;
    await prisma.inboundMessage.update({ where: { id: best.id }, data: { intent: best.intent } });
    await prisma.lead.update({ where: { id: l.id }, data: { lastIntent: best.intent, needsReply: true, ...(outcome.stage ? { crmStatus: outcome.stage } : {}) } });
  }
  console.log(`${changed} lead(s) ${apply ? "fixed" : "would be fixed"}`);
  await prisma.$disconnect();
}
void main();
