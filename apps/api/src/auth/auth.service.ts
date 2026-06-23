import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    const hashed = await bcrypt.hash(dto.password, 12);
    const slug = dto.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        accounts: {
          create: {
            accountId: dto.email,
            providerId: "credential",
            password: hashed,
          },
        },
        memberships: {
          create: {
            role: "owner",
            workspace: {
              create: {
                name: dto.workspaceName,
                slug: uniqueSlug,
              },
            },
          },
        },
      },
      include: { memberships: { include: { workspace: true } } },
    });

    const workspace = user.memberships[0].workspace;
    const token = this.jwt.sign({ sub: user.id, workspaceId: workspace.id, email: user.email });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        accounts: { where: { providerId: "credential" } },
        memberships: { include: { workspace: true }, take: 1 },
      },
    });

    if (!user || !user.accounts[0]?.password) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await bcrypt.compare(dto.password, user.accounts[0].password);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    const workspace = user.memberships[0]?.workspace;
    const token = this.jwt.sign({
      sub: user.id,
      workspaceId: workspace?.id ?? "default-workspace",
      email: user.email,
    });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
        : null,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { workspace: true }, take: 1 } },
    });
    if (!user) throw new UnauthorizedException();
    const workspace = user.memberships[0]?.workspace;
    return {
      user: { id: user.id, name: user.name, email: user.email },
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
        : null,
    };
  }
}
