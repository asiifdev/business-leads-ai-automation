import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";

/** Throws unless `userId` is an owner or admin of the workspace. A missing user id is refused, never waved through. */
export async function assertOwnerOrAdmin(prisma: PrismaService, workspaceId: string, userId: string | undefined, what = "change this"): Promise<void> {
  if (!userId) throw new ForbiddenException(`Only workspace owners and admins can ${what}`);
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!m || !["owner", "admin"].includes(m.role)) throw new ForbiddenException(`Only workspace owners and admins can ${what}`);
}
