import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
}
