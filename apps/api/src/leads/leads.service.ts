import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { normalizePhone } from "../messaging/phone";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export interface LeadFilter {
  campaignId?: string;
  q?: string;
  priority?: string;
  status?: string;
  province?: string;
  regency?: string;
  district?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  /** The filter shared by the list, the map and the region counts. */
  private where(workspaceId: string, filter: LeadFilter): Prisma.LeadWhereInput {
    const { campaignId, q, priority, status, province, regency, district } = filter;
    const term = q?.trim().slice(0, 100);
    // Phone numbers are stored as typed ("0812-...") and as digits with country code, so match on digits too.
    const digits = term?.replace(/\D/g, "") ?? "";
    const phoneDigits = digits.length >= 3 ? digits.replace(/^0+/, "") : "";
    return {
      workspaceId,
      ...(campaignId && { campaignId }),
      ...(priority && { priority }),
      ...(status && { crmStatus: status }),
      ...(province && { province }),
      ...(regency && { regency }),
      ...(district && { district }),
      ...(term && {
        OR: [
          ...(["name", "address", "website", "email", "category", "phone", "province", "regency", "district"] as const).map((f) => ({ [f]: { contains: term, mode: "insensitive" as const } })),
          ...(phoneDigits ? [{ phoneE164: { contains: phoneDigits } }] : []),
        ],
      }),
    };
  }

  /** Every lead with coordinates for the map (no paging: the map is for seeing them all), lightest fields only. */
  async mapPoints(workspaceId: string, filter: LeadFilter = {}) {
    return this.prisma.lead.findMany({
      where: { ...this.where(workspaceId, filter), lat: { not: null }, lng: { not: null } },
      orderBy: [{ score: "desc" }],
      take: 5000,
      select: { id: true, name: true, address: true, phone: true, rating: true, reviewCount: true, priority: true, lat: true, lng: true, province: true, regency: true, district: true },
    });
  }

  /** Province -> kabupaten/kota -> kecamatan with how many leads each holds, for the filters. */
  async regions(workspaceId: string, campaignId?: string) {
    const rows = await this.prisma.lead.groupBy({
      by: ["province", "regency", "district"],
      where: { workspaceId, ...(campaignId && { campaignId }), province: { not: null } },
      _count: { _all: true },
    });
    const tree = new Map<string, { name: string; count: number; regencies: Map<string, { name: string; count: number; districts: Map<string, number> }> }>();
    for (const r of rows) {
      const p = tree.get(r.province!) ?? { name: r.province!, count: 0, regencies: new Map() };
      p.count += r._count._all;
      if (r.regency) {
        const k = p.regencies.get(r.regency) ?? { name: r.regency, count: 0, districts: new Map<string, number>() };
        k.count += r._count._all;
        if (r.district) k.districts.set(r.district, (k.districts.get(r.district) ?? 0) + r._count._all);
        p.regencies.set(r.regency, k);
      }
      tree.set(r.province!, p);
    }
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, "id");
    return [...tree.values()].sort(byName).map((p) => ({
      name: p.name,
      count: p.count,
      regencies: [...p.regencies.values()].sort(byName).map((k) => ({
        name: k.name,
        count: k.count,
        districts: [...k.districts].map(([name, count]) => ({ name, count })).sort(byName),
      })),
    }));
  }

  async findAll(workspaceId = DEFAULT_WORKSPACE_ID, filter: LeadFilter = {}) {
    const limit = Math.min(Math.max(Number.isFinite(filter.limit) ? Math.floor(filter.limit as number) : 50, 1), 200);
    const page = Math.max(Number.isFinite(filter.page) ? Math.floor(filter.page as number) : 1, 1);
    const skip = (page - 1) * limit;
    const where = this.where(workspaceId, filter);

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

  /**
   * A contact someone passed us becomes a lead of its own, in the same campaign, so it gets its own conversation and follow-up.
   * The same number is never added twice in one workspace.
   */
  async createFromReferral(workspaceId: string, fromLeadId: string, input: { name?: string; phone: string }) {
    const from = await this.prisma.lead.findFirst({ where: { id: fromLeadId, workspaceId }, select: { id: true, name: true, category: true, campaignId: true } });
    if (!from) throw new NotFoundException(`Lead ${fromLeadId} not found`);
    const account = await this.prisma.whatsappAccount.findUnique({ where: { workspaceId }, select: { defaultCountryCode: true } });
    const phoneE164 = normalizePhone(input.phone, account?.defaultCountryCode ?? "62");
    if (!phoneE164) throw new BadRequestException("That phone number is not valid");
    const existing = await this.prisma.lead.findFirst({ where: { workspaceId, phoneE164 }, select: { id: true } });
    if (existing) return { created: false, leadId: existing.id };
    const lead = await this.prisma.lead.create({
      data: {
        workspaceId, campaignId: from.campaignId, name: (input.name?.trim() || `Kontak dari ${from.name}`).slice(0, 160), phone: input.phone.trim().slice(0, 40), phoneE164,
        category: from.category, source: "referral", priority: "MEDIUM", crmStatus: "new", aiAnalysis: { referral: { from: from.id } },
      },
      select: { id: true },
    });
    await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: "referral_added", note: `Dari ${from.name}` } });
    return { created: true, leadId: lead.id };
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
        ...(dto.followUpDate && { followUpDate: new Date(dto.followUpDate) }),
        // moving a deal on means the owner has dealt with the last reply
        ...(dto.crmStatus && dto.needsReply === undefined && { needsReply: false }),
        ...(dto.crmStatus && dto.crmStatus !== "lost" && { lostReason: null }),
        ...(dto.crmStatus === "contacted" && { contactedAt: now }),
        ...(dto.crmStatus === "replied" && { repliedAt: now }),
        ...(["won", "lost"].includes(dto.crmStatus ?? "") && { closedAt: now }),
      },
    });
    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        type: "crm_update",
        note: dto.crmStatus ? `Status changed to ${dto.crmStatus}` : "Deal details updated",
        metadata: dto as object,
      },
    });
    return lead;
  }

  async createMany(leads: Array<{
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    website?: string;
    rating?: string;
    reviewCount?: number;
    hasWebsite?: boolean;
    referenceUrl?: string;
    source?: string;
    category?: string;
    score?: number;
    priority?: string;
    marketingContent?: object;
    aiAnalysis?: object;
    campaignId: string;
    workspaceId: string;
  }>) {
    return this.prisma.lead.createMany({
      data: leads.map((l) => ({ ...l, phoneE164: normalizePhone(l.phone) })),
      skipDuplicates: true,
    });
  }
}
