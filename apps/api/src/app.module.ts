import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import * as Joi from "joi";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { LeadsModule } from "./leads/leads.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { ScraperModule } from "./scraper/scraper.module";
import { AiModule } from "./ai/ai.module";
import { SettingsModule } from "./settings/settings.module";
import { ExportModule } from "./export/export.module";
import { AuthModule } from "./auth/auth.module";
import { WorkspaceModule } from "./workspace/workspace.module";
import { MessagingModule } from "./messaging/messaging.module";
import { MarketingModule } from "./marketing/marketing.module";
import { EmailModule } from "./email/email.module";
import { EntitlementsModule } from "./entitlements/entitlements.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        ENCRYPTION_KEY: Joi.string().base64().required(),
        REDIS_URL: Joi.string().default("redis://localhost:6379"),
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
        OPENAI_API_KEY: Joi.string().allow("").default(""),
        OPENAI_MODEL: Joi.string().default("gpt-4o-mini"),
        OPENAI_BASE_URL: Joi.string().allow("").default(""),
        OPENAI_REASONING_EFFORT: Joi.string().allow("").default(""),
        EMBEDDING_MODEL: Joi.string().default("text-embedding-3-small"),
        PUBLIC_API_URL: Joi.string().uri().optional(),
        EMAIL_DISABLED: Joi.string().valid("true", "false").optional(),
        ALLOW_LOCAL_UNSUBSCRIBE: Joi.string().valid("true", "false").optional(),
  EMAIL_ALLOW_PRIVATE_SMTP: Joi.string().valid("true", "false").optional(),
        NEXT_PUBLIC_APP_URL: Joi.string().default("http://localhost:3000"),
        CORS_ORIGINS: Joi.string().allow("").optional(),
        THROTTLE_TTL_MS: Joi.number().default(60000),
        THROTTLE_LIMIT: Joi.number().default(60),
        AUTH_THROTTLE_LIMIT: Joi.number().default(10),
        WA_AUTH_DIR: Joi.string().allow("").default(""),
        BRIEF_SOURCE_CHARS: Joi.number().default(30000),
        EDITION: Joi.string().valid("community", "hosted").default("community"),
        AI_ALLOW_PRIVATE_BASE_URL: Joi.string().valid("true", "false").optional(),
        WHATSAPP_CLOUD_PLUGIN: Joi.string().allow("").default(""),
        SCRAPER_MODE: Joi.string().valid("live", "fixture").default("live"),
        WHATSAPP_DISABLED: Joi.string().valid("true", "false").default("false"),
        ATTACHMENTS_DIR: Joi.string().optional(),
        REPLY_DRAFT_DELAY_MS: Joi.number().integer().min(0).max(600000).optional(),
        GEOCODER_DISABLED: Joi.string().valid("true", "false").default("false"),
        GEOCODER_URL: Joi.string().uri().optional(),
        GEOCODER_USER_AGENT: Joi.string().optional(),
        OVERPASS_URL: Joi.string().uri().optional(),
        OVERPASS_DISABLED: Joi.string().valid("true", "false").default("false"),
      }),
      validationOptions: { abortEarly: true },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS) || 60000,
        limit: Number(process.env.THROTTLE_LIMIT) || 60,
      },
    ]),
    PrismaModule,
    CampaignsModule,
    LeadsModule,
    AnalyticsModule,
    ScraperModule,
    AiModule,
    SettingsModule,
    ExportModule,
    AuthModule,
    WorkspaceModule,
    MessagingModule,
    MarketingModule,
    EmailModule,
    EntitlementsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
