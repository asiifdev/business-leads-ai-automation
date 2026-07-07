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
        NEXT_PUBLIC_APP_URL: Joi.string().default("http://localhost:3000"),
      }),
      validationOptions: { abortEarly: true },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
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
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
