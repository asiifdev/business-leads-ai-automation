import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { makeWorkspaceSlug } from "../workspace/slug";

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
    const uniqueSlug = makeWorkspaceSlug(dto.workspaceName);

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
        memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" }, take: 1 },
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

  /** The workspace the token points at (after a switch), or the oldest one when the token's workspace is gone. */
  async me(userId: string, workspaceId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!user) throw new UnauthorizedException();
    const workspace = (user.memberships.find((m) => m.workspaceId === workspaceId) ?? user.memberships[0])?.workspace;
    return {
      user: { id: user.id, name: user.name, email: user.email },
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
        : null,
    };
  }
}
