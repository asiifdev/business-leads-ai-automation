import { createHash } from "crypto";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;

    if (!authHeader?.startsWith("ApiKey ")) throw new UnauthorizedException("Missing or invalid API key");

    const plaintext = authHeader.slice(7).trim();
    if (!plaintext.startsWith("px_")) throw new UnauthorizedException("Invalid API key format");

    const keyHash = createHash("sha256").update(plaintext).digest("hex");

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { workspace: true },
    });

    if (!apiKey) throw new UnauthorizedException("API key not found or revoked");
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException("API key has expired");
    }

    // Update lastUsedAt without blocking the request
    this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);

    req.user = { workspaceId: apiKey.workspaceId, apiKeyId: apiKey.id };
    return true;
  }
}
