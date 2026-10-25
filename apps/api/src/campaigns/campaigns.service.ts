import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { defaultLanguageFor } from "../common/language";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
    });
  }

  async findOne(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { leads: true } } },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async create(dto: CreateCampaignDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      create: { id: workspaceId, name: "Default Workspace", slug: "default" },
      update: {},
    });
    return this.prisma.campaign.create({
      data: {
        ...dto,
        maxResults: dto.maxResults ?? 20,
        contentStyle: dto.contentStyle ?? "balanced",
        language: dto.language ?? defaultLanguageFor(dto.country),
        workspaceId,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    return this.prisma.campaign.delete({ where: { id } });
  }

  async updateStatus(id: string, status: string, progress?: number, error?: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        status,
        ...(progress !== undefined && { progress }),
        // A message belongs to one run: starting or finishing a run replaces the last one (a finished run may carry a warning).
        ...(status === "running" || status === "completed" ? { error: error ?? null } : error ? { error } : {}),
        ...(status === "running" && { startedAt: new Date() }),
        ...(status === "completed" && { completedAt: new Date() }),
      },
    });
  }

  /** Counts from the leads the campaign holds now, so a second run or an import adds to the totals instead of replacing them. */
  async refreshStats(id: string) {
    const where = { campaignId: id };
    const [totalLeads, priorityLeads, highQualityLeads, avg] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...where, priority: "HIGH" } }),
      this.prisma.lead.count({ where: { ...where, score: { gte: 70 } } }),
      this.prisma.lead.aggregate({ where, _avg: { score: true } }),
    ]);
    return this.updateStats(id, { totalLeads, priorityLeads, highQualityLeads, averageScore: Math.round(avg._avg.score ?? 0) });
  }

  async updateStats(id: string, stats: {
    totalLeads?: number;
    priorityLeads?: number;
    highQualityLeads?: number;
    averageScore?: number;
  }) {
    return this.prisma.campaign.update({ where: { id }, data: stats });
  }
}
