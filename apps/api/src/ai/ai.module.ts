import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiClientService } from "./ai-client.service";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";
import { StyleController } from "./style.controller";
import { StyleService } from "./style.service";
import { LeadIntelligenceService } from "./lead-intelligence.service";
import { MarketingAiService } from "./marketing-ai.service";

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController, StyleController],
  providers: [LeadIntelligenceService, MarketingAiService, AiClientService, KnowledgeService, StyleService],
  exports: [LeadIntelligenceService, MarketingAiService, AiClientService, KnowledgeService, StyleService],
})
export class AiModule {}
