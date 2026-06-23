import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
