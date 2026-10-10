import { Body, Controller, Delete, Get, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { MAX_BULK, MAX_EMAIL_BODY } from "../messaging/messaging.service";
import { EmailService, MAX_GENERATE } from "./email.service";

class AccountDto {
  @IsString() @MinLength(3) @MaxLength(253) host!: string;
  @IsInt() @Min(1) @Max(65535) port!: number;
  @IsBoolean() secure!: boolean;
  @IsString() @MinLength(1) @MaxLength(254) username!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) password?: string;
  @IsString() @MinLength(1) @MaxLength(120) fromName!: string;
  @IsEmail() @MaxLength(254) fromEmail!: string;
  @IsOptional() @IsEmail() @MaxLength(254) replyTo?: string;
  @IsString() @MinLength(10) @MaxLength(300) postalAddress!: string;
  @IsOptional() @IsInt() @Min(1) @Max(30) hourlyLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) dailyLimit?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) quietStartHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) quietEndHour?: number;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsBoolean() paused?: boolean;
}
class GenerateDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_BULK) @IsString({ each: true }) leadIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(MAX_GENERATE) limit?: number;
}
class ManualDto {
  @IsEmail() @MaxLength(254) to!: string;
  @IsString() @MinLength(1) @MaxLength(200) subject!: string;
  @IsString() @MinLength(1) @MaxLength(MAX_EMAIL_BODY) body!: string;
  @IsOptional() @IsString() leadId?: string;
}

@ApiTags("Email")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("email")
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Get()
  @ApiOperation({ summary: "Email account (without the password), limits and usage" })
  overview(@WorkspaceId() ws: string) { return this.email.overview(ws); }

  @Put("account")
  @ApiOperation({ summary: "Save the SMTP account. Leave the password out to keep the saved one." })
  save(@WorkspaceId() ws: string, @Body() dto: AccountDto) { return this.email.save(ws, dto); }

  @Delete("account")
  remove(@WorkspaceId() ws: string) { return this.email.remove(ws); }

  @Post("account/test")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Log in to the mail server without sending anything" })
  test(@WorkspaceId() ws: string) { return this.email.test(ws); }

  @Post("outbox/generate")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Draft first emails for leads with an address found on their website (sends nothing)" })
  generate(@WorkspaceId() ws: string, @Body() dto: GenerateDto) { return this.email.startGeneration(ws, dto); }

  @Get("outbox/generate")
  generationStatus(@WorkspaceId() ws: string) {
    // always a JSON object: an empty body breaks clients that call res.json()
    return this.email.generationStatus(ws) ?? { running: false, total: 0, done: 0, created: 0, failed: 0, skipped: { noEmail: 0, optedOut: 0, duplicateAddress: 0 }, firstError: null };
  }

  @Post("outbox/manual")
  @ApiOperation({ summary: "A hand-written email draft (still needs approval)" })
  manual(@WorkspaceId() ws: string, @Body() dto: ManualDto) { return this.email.createManual(ws, { to: dto.to, subject: dto.subject, body: dto.body, leadId: dto.leadId }); }
}
