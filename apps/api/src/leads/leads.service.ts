import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId = DEFAULT_WORKSPACE_ID, campaignId?: string) {
    return this.prisma.lead.findMany({
      where: { workspaceId, ...(campaignId && { campaignId }) },
      orderBy: [{ priority: "asc" }, { score: "desc" }],
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 5 },
        campaign: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        activities: { orderBy: { createdAt: "desc" } },
        campaign: { select: { id: true, name: true } },
        followUps: { where: { done: false }, orderBy: { scheduledAt: "asc" } },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async updateCrm(id: string, dto: UpdateCrmDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    const now = new Date();
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.crmStatus === "contacted" && { contactedAt: now }),
        ...(dto.crmStatus === "replied" && { repliedAt: now }),
        ...(["won", "lost"].includes(dto.crmStatus ?? "") && { closedAt: now }),
      },
    });
    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        type: "crm_update",
        note: `Status changed to ${dto.crmStatus}`,
        metadata: dto as object,
      },
    });
    return lead;
  }

  async createMany(leads: Array<{
    name: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: string;
    hasWebsite?: boolean;
    score?: number;
    priority?: string;
    marketingContent?: object;
    aiAnalysis?: object;
    campaignId: string;
    workspaceId: string;
  }>) {
    return this.prisma.lead.createMany({ data: leads, skipDuplicates: true });
  }
}
