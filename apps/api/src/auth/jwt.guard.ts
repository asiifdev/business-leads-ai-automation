import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
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
    return true;
  }
}
