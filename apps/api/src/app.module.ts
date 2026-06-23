import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CampaignsModule,
    LeadsModule,
    AnalyticsModule,
    ScraperModule,
    AiModule,
    SettingsModule,
    ExportModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
