import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScraperController } from "./scraper.controller";
import { ScraperProcessor } from "./scraper.processor";
import { GoogleMapsScraperService } from "./google-maps.scraper";
import { GoogleMapsSource } from "./sources/google-maps.source";
import { OsmSource } from "./sources/osm.source";
import { OvertureSource } from "./sources/overture.source";
import { LeadCollectorService } from "./lead-collector.service";
import { LeadPipelineService } from "./lead-pipeline.service";
import { LeadImportService } from "./lead-import.service";
import { WebsiteListService } from "./website-list.service";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { LeadsModule } from "../leads/leads.module";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
        },
      }),
    }),
    BullModule.registerQueue({ name: "scraper" }),
    CampaignsModule,
    LeadsModule,
    AiModule,
    AuthModule,
  ],
  controllers: [ScraperController],
  providers: [ScraperProcessor, GoogleMapsScraperService, GoogleMapsSource, OsmSource, OvertureSource, LeadCollectorService, LeadPipelineService, LeadImportService, WebsiteListService],
  exports: [LeadCollectorService, LeadPipelineService],
})
export class ScraperModule {}
