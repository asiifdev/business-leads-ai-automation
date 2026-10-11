import { Body, Controller, Delete, Get, HttpException, Inject, NotFoundException, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { CurrentUserId } from "../auth/current-user.decorator";
import { ConfigService } from "@nestjs/config";
import { assertInstanceAdmin, isInstanceAdmin } from "../auth/instance-admin";
import { PrismaService } from "../prisma/prisma.service";
import { CLOUD_HOST, type CloudHost } from "./cloud-host";
import { LicenseError, type LicenseProvider } from "./license.provider";
import { LimitsService } from "./limits.service";

class KeyDto {
  @IsString() @MaxLength(80) key!: string;
}
class EmailDto {
  @IsEmail() @MaxLength(200) email!: string;
}

/** Licence key management for self-hosted installs. Hosted accounts are managed by subscription instead. */
@ApiTags("License")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("license")
export class LicenseController {
  constructor(@Inject(CLOUD_HOST) private readonly host: CloudHost, private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly limits: LimitsService) {}

  private get license(): LicenseProvider {
    if (!this.host.license) throw new NotFoundException("Licence keys apply to self-hosted installs. This server is managed by subscription.");
    return this.host.license;
  }

  @Get()
  async status(@CurrentUserId() userId: string) {
    if (!this.host.license) return { managed: true };
    return { managed: false, canManage: await isInstanceAdmin(this.prisma, this.config, userId), ...this.host.license.status() };
  }

  @Put()
  async set(@Body() dto: KeyDto, @CurrentUserId() userId: string) {
    await assertInstanceAdmin(this.prisma, this.config, userId);
    const status = await this.wrap(() => this.license.setKey(dto.key));
    this.limits.forgetAll(); // features changed: do not serve the cached entitlements
    return status;
  }

  @Delete()
  async clear(@CurrentUserId() userId: string) {
    await assertInstanceAdmin(this.prisma, this.config, userId);
    await this.license.clearKey();
    this.limits.forgetAll();
    return { ok: true };
  }

  @Post("register")
  async register(@Body() dto: EmailDto, @CurrentUserId() userId: string) {
    await assertInstanceAdmin(this.prisma, this.config, userId);
    await this.wrap(() => this.license.requestFreeKey(dto.email));
    return { ok: true };
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof LicenseError) throw new HttpException(e.message, e.status);
      throw e;
    }
  }
}
