import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Who administers the whole install (as opposed to one workspace). `PLATFORM_ADMIN_USER_IDS` (comma separated) if set;
 * otherwise the first account ever created on this install, which is the person who set it up. That choice is written
 * down the first time it is needed (instance setting `instance_admin_id`), so deleting or re-ordering accounts later can
 * never hand the role to someone else. Workspace roles are not enough: on an open-registration install everyone is the
 * owner of their own workspace.
 */
export async function isInstanceAdmin(prisma: PrismaService, config: ConfigService, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const listed = (config.get<string>("PLATFORM_ADMIN_USER_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (listed.length) return listed.includes(userId);
  const saved = await prisma.instanceSetting.findUnique({ where: { key: "instance_admin_id" } });
  if (saved) return saved.value === userId;
  const first = await prisma.user.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
  if (!first) return false;
  // createMany + skipDuplicates keeps the first writer if two requests race.
  await prisma.instanceSetting.createMany({ data: [{ key: "instance_admin_id", value: first.id }], skipDuplicates: true });
  const now = await prisma.instanceSetting.findUnique({ where: { key: "instance_admin_id" } });
  return now?.value === userId;
}

export async function assertInstanceAdmin(prisma: PrismaService, config: ConfigService, userId: string | undefined): Promise<void> {
  if (!(await isInstanceAdmin(prisma, config, userId))) throw new ForbiddenException("Only the administrator of this install can manage the licence");
}
