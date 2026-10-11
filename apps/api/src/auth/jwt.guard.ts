import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const MEMBERSHIP_CACHE_MS = 10_000;
// Tokens issued to a login that has no workspace yet carry this placeholder; it grants no data.
const PLACEHOLDER_WORKSPACE = "default-workspace";

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly members = new Map<string, number>();

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedException("Missing token");

    const token = authHeader.slice(7);
    try {
      req.user = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    await this.requireMembership(req.user?.sub, req.user?.workspaceId);
    return true;
  }

  /** A token outlives the membership it was issued for (30 days). Re-check it, briefly cached, so removal takes effect. */
  private async requireMembership(userId: string | undefined, workspaceId: string | undefined): Promise<void> {
    if (!userId || !workspaceId || workspaceId === PLACEHOLDER_WORKSPACE) return;
    const key = `${userId}:${workspaceId}`;
    const seen = this.members.get(key);
    if (seen && Date.now() - seen < MEMBERSHIP_CACHE_MS) return;
    const m = await this.prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { id: true } });
    if (!m) {
      this.members.delete(key);
      throw new UnauthorizedException("You no longer have access to this workspace");
    }
    if (this.members.size > 5000) this.members.clear();
    this.members.set(key, Date.now());
  }
}
