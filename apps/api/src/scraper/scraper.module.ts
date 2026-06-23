import { Module } from "@nestjs/common";
import { ScraperController } from "./scraper.controller";
import { ScraperProcessor } from "./scraper.processor";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { LeadsModule } from "../leads/leads.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [CampaignsModule, LeadsModule, AiModule],
  controllers: [ScraperController],
  providers: [ScraperProcessor],
})
export class ScraperModule {}
