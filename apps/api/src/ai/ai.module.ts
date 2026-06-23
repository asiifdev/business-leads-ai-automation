import { Module } from "@nestjs/common";
import { LeadIntelligenceService } from "./lead-intelligence.service";
import { MarketingAiService } from "./marketing-ai.service";

@Module({
  providers: [LeadIntelligenceService, MarketingAiService],
  exports: [LeadIntelligenceService, MarketingAiService],
})
export class AiModule {}
