import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { makeWorkspaceSlug, MAX_WORKSPACES_PER_USER } from "./slug";

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  /** Every workspace the user belongs to, with enough numbers to tell businesses apart in a switcher. */
  async listMine(userId: string, currentWorkspaceId: string) {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { workspace: { include: { _count: { select: { campaigns: true, leads: true } } } } },
    });
    return rows.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      plan: m.workspace.plan,
      role: m.role,
      campaigns: m.workspace._count.campaigns,
      leads: m.workspace._count.leads,
      current: m.workspace.id === currentWorkspaceId,
    }));
  }

  /** A new business under the same login. The caller becomes its owner and a token for it is returned. */
  async create(userId: string, name: string) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 80) throw new BadRequestException("Give the workspace a name of 2 to 80 characters");
    const owned = await this.prisma.workspaceMember.count({ where: { userId } });
    if (owned >= MAX_WORKSPACES_PER_USER) throw new BadRequestException(`A login can have at most ${MAX_WORKSPACES_PER_USER} workspaces`);
    const workspace = await this.prisma.workspace.create({
      data: { name: clean, slug: makeWorkspaceSlug(clean), members: { create: { userId, role: "owner" } } },
    });
    return this.session(userId, workspace);
  }

  /** Moves the login to another of its workspaces. Membership is checked here, so a token cannot be pointed anywhere else. */
  async switchTo(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });
    if (!m) throw new ForbiddenException("You are not a member of that workspace");
    return this.session(userId, m.workspace);
  }

  private async session(userId: string, workspace: { id: string; name: string; slug: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user) throw new NotFoundException("User not found");
    const token = this.jwt.sign({ sub: user.id, workspaceId: workspace.id, email: user.email });
    return { token, user, workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException("Workspace not found");
    return workspace;
  }

  async updateWorkspace(
    workspaceId: string,
    data: { name?: string; slug?: string },
    requesterId: string,
  ) {
    await this.requireOwnerOrAdmin(workspaceId, requesterId);

    if (data.slug) {
      const existing = await this.prisma.workspace.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== workspaceId) {
        throw new ConflictException("Slug is already taken");
      }
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
      },
    });
  }

  async getMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async inviteMember(workspaceId: string, email: string, role: string, requesterId: string) {
    await this.requireOwnerOrAdmin(workspaceId, requesterId);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`No user found with email ${email}`);

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) throw new ConflictException("User is already a member of this workspace");

    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: role || "member" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateMemberRole(workspaceId: string, memberId: string, role: string, requesterId: string) {
    await this.requireOwnerOrAdmin(workspaceId, requesterId);

    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "owner") throw new ForbiddenException("Cannot change the owner's role");

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async removeMember(workspaceId: string, memberId: string, requesterId: string) {
    await this.requireOwnerOrAdmin(workspaceId, requesterId);

    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "owner") throw new ForbiddenException("Cannot remove the workspace owner");

    return this.prisma.workspaceMember.delete({ where: { id: memberId } });
  }

  private async requireOwnerOrAdmin(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new ForbiddenException("Only workspace owners and admins can manage members");
    }
  }
}
