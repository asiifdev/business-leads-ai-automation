import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** A warm lead the owner answered last and who has not written back for this many days shows under "Waiting on them". */
const WAITING_DAYS = 3;
const DEFAULT_WORKSPACE_ID = "default-workspace";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(workspaceId = DEFAULT_WORKSPACE_ID) {
    const [totalLeads, activeCampaigns, crmStats] = await Promise.all([
      this.prisma.lead.count({ where: { workspaceId } }),
      this.prisma.campaign.count({
        where: { workspaceId, status: { in: ["running", "completed"] } },
      }),
      this.prisma.lead.groupBy({
        by: ["crmStatus"],
        where: { workspaceId },
        _count: { crmStatus: true },
      }),
    ]);

    const won = crmStats.find((s) => s.crmStatus === "won")?._count.crmStatus ?? 0;
    const conversionRate = totalLeads > 0 ? ((won / totalLeads) * 100).toFixed(1) : "0";

    return {
      totalLeads,
      activeCampaigns,
      conversionRate: `${conversionRate}%`,
      dealsWon: won,
      crmPipeline: crmStats.map((s) => ({
        status: s.crmStatus,
        count: s._count.crmStatus,
      })),
    };
  }

  async getLeadsByIndustry(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.lead.groupBy({
      by: ["category"],
      where: { workspaceId },
      _count: { id: true },
      _avg: { score: true },
      orderBy: { _count: { id: "desc" } },
    });
  }

  async getCampaignStats(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        totalLeads: true,
        priorityLeads: true,
        averageScore: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Everything the owner needs to follow leads to closing: stage counts and value, who is waiting for an answer, who went quiet. */
  async getPipeline(workspaceId = DEFAULT_WORKSPACE_ID) {
    const staleBefore = new Date(Date.now() - 7 * 86_400_000);
    const lite = { id: true, name: true, phone: true, category: true, crmStatus: true, dealValue: true, lastIntent: true, repliedAt: true, contactedAt: true, followUpDate: true, campaignId: true } as const;
    const needsReplyWhere = { workspaceId, needsReply: true, crmStatus: { notIn: ["won", "lost"] } };
    const staleWhere = { workspaceId, crmStatus: "contacted", contactedAt: { lt: staleBefore } };
    // warm leads the owner answered last and who have not written back: the owner is waiting on them, nothing is drafted for it
    const waitingWhere = { workspaceId, crmStatus: { in: ["replied", "interested", "meeting", "proposal"] }, needsReply: false, repliedAt: { not: null }, contactedAt: { lt: new Date(Date.now() - WAITING_DAYS * 86_400_000) } };
    const dueWhere = { workspaceId, followUpDate: { lte: new Date() }, crmStatus: { notIn: ["won", "lost"] } };
    const unmatchedWhere = { workspaceId, leadId: null, receivedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } };
    const [byStage, needsReply, stale, dueFollowUps, lost, byCampaign, unmatched, totals, waitingOnThem] = await Promise.all([
      this.prisma.lead.groupBy({ by: ["crmStatus"], where: { workspaceId }, _count: { _all: true }, _sum: { dealValue: true } }),
      this.prisma.lead.findMany({ where: needsReplyWhere, orderBy: { repliedAt: "asc" }, take: 50, select: lite }),
      this.prisma.lead.findMany({ where: staleWhere, orderBy: { contactedAt: "asc" }, take: 50, select: lite }),
      this.prisma.lead.findMany({ where: dueWhere, orderBy: { followUpDate: "asc" }, take: 50, select: lite }),
      this.prisma.lead.groupBy({ by: ["lostReason"], where: { workspaceId, crmStatus: "lost" }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ["campaignId", "crmStatus"], where: { workspaceId }, _count: { _all: true } }),
      // messages from senders that match no lead (typically hidden-number contacts): shown so a STOP or a real answer is never lost unseen
      this.prisma.inboundMessage.findMany({ where: unmatchedWhere, orderBy: { receivedAt: "desc" }, take: 20, select: { id: true, fromPhone: true, body: true, receivedAt: true } }),
      // the lists above are capped; these are the real numbers, so a badge never says 50 when there are 300
      Promise.all([this.prisma.lead.count({ where: needsReplyWhere }), this.prisma.lead.count({ where: staleWhere }), this.prisma.lead.count({ where: dueWhere }), this.prisma.inboundMessage.count({ where: unmatchedWhere })]),
      Promise.all([this.prisma.lead.findMany({ where: waitingWhere, orderBy: { contactedAt: "asc" }, take: 50, select: lite }), this.prisma.lead.count({ where: waitingWhere })]),
    ]);
    const stages = ["new", "contacted", "replied", "interested", "meeting", "proposal", "won", "lost"].map((stage) => {
      const row = byStage.find((r) => r.crmStatus === stage);
      return { stage, count: row?._count._all ?? 0, value: row?._sum.dealValue ?? 0 };
    });
    const n = (stage: string) => stages.find((x) => x.stage === stage)!.count;
    const reachedReply = n("replied") + n("interested") + n("meeting") + n("proposal") + n("won");
    const contactedOrMore = reachedReply + n("contacted") + n("lost");
    const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
    const campaigns = await this.prisma.campaign.findMany({ where: { workspaceId, id: { in: [...new Set(byCampaign.map((r) => r.campaignId))] } }, select: { id: true, name: true } });
    return {
      stages,
      pipelineValue: stages.filter((x) => !["won", "lost"].includes(x.stage)).reduce((a, x) => a + x.value, 0),
      wonValue: stages.find((x) => x.stage === "won")!.value,
      rates: { replyRate: rate(reachedReply, contactedOrMore), winRate: rate(n("won"), n("won") + n("lost")) },
      needsReply,
      stale,
      totals: { needsReply: totals[0], stale: totals[1], dueFollowUps: totals[2], unmatched: totals[3], waitingOnThem: waitingOnThem[1] },
      waitingOnThem: waitingOnThem[0],
      unmatched: unmatched.map((m) => ({ ...m, body: m.body.slice(0, 200), hidden: m.fromPhone.startsWith("lid:") })),
      dueFollowUps,
      lostReasons: lost.map((r) => ({ reason: r.lostReason ?? "—", count: r._count._all })).sort((a, b) => b.count - a.count),
      campaigns: campaigns.map((c) => {
        const rows = byCampaign.filter((r) => r.campaignId === c.id);
        const count = (stage: string) => rows.filter((r) => r.crmStatus === stage).reduce((a, r) => a + r._count._all, 0);
        return { id: c.id, name: c.name, total: rows.reduce((a, r) => a + r._count._all, 0), contacted: rows.filter((r) => r.crmStatus !== "new").reduce((a, r) => a + r._count._all, 0), replied: count("replied") + count("interested") + count("meeting") + count("proposal") + count("won"), won: count("won") };
      }),
    };
  }
}
