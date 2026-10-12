/**
 * One-off clean-up: replies that were only a shop's automatic greeting but were counted as real replies.
 * Moves such leads back to "contacted", clears "needs reply" and rejects the reply drafts written for them.
 * Run: DATABASE_URL=... npx tsx scripts/fix-auto-replies.ts [--apply]   (dry run without --apply)
 */
import { PrismaClient } from "@prisma/client";
import { classifyReply } from "../src/messaging/reply-intent";

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  const leads = await prisma.lead.findMany({ where: { OR: [{ crmStatus: "replied" }, { needsReply: true }] }, select: { id: true, name: true, crmStatus: true, workspaceId: true, phoneE164: true } });
  let fixed = 0;
  for (const l of leads) {
    const inbound = await prisma.inboundMessage.findMany({ where: { workspaceId: l.workspaceId, OR: [{ leadId: l.id }, ...(l.phoneE164 ? [{ fromPhone: l.phoneE164 }] : [])] }, select: { id: true, body: true } });
    if (inbound.length === 0 || !inbound.every((m) => classifyReply(m.body) === "auto_reply")) continue;
    fixed++;
    console.log(`${apply ? "fix" : "would fix"}: ${l.name} (${l.crmStatus})`);
    if (!apply) continue;
    await prisma.inboundMessage.updateMany({ where: { id: { in: inbound.map((m) => m.id) } }, data: { intent: "auto_reply" } });
    await prisma.lead.update({ where: { id: l.id }, data: { ...(l.crmStatus === "replied" ? { crmStatus: "contacted", repliedAt: null } : {}), needsReply: false, lastIntent: "auto_reply" } });
    await prisma.outboundMessage.updateMany({ where: { leadId: l.id, source: "ai_reply", status: "draft" }, data: { status: "rejected", error: "Reply was only an automatic greeting" } });
  }
  console.log(`${fixed} lead(s) ${apply ? "fixed" : "would be fixed"}`);
  await prisma.$disconnect();
}
void main();
