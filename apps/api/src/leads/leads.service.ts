import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export interface LeadFilter {
  campaignId?: string;
  q?: string;
  priority?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId = DEFAULT_WORKSPACE_ID, filter: LeadFilter = {}) {
    const { campaignId, q, priority, status, page = 1, limit = 50 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      ...(campaignId && { campaignId }),
      ...(priority && { priority }),
      ...(status && { crmStatus: status }),
      ...(q && { name: { contains: q, mode: "insensitive" as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: [{ priority: "asc" }, { score: "desc" }],
        skip,
        take: limit,
        include: {
          activities: { orderBy: { createdAt: "desc" }, take: 5 },
          campaign: { select: { id: true, name: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total, page, limit };
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
