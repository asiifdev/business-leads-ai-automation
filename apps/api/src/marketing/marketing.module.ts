import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { BriefService } from "./brief.service";
import { MarketingController } from "./marketing.controller";
import { PageRenderer } from "./page-renderer";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [MarketingController],
  providers: [BriefService, PageRenderer],
  exports: [BriefService],
})
export class MarketingModule {}
