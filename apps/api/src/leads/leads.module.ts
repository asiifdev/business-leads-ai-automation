import { Module } from "@nestjs/common";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { EnrichmentService } from "./enrichment.service";
import { MarketingModule } from "../marketing/marketing.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, MarketingModule],
  controllers: [LeadsController],
  providers: [LeadsService, EnrichmentService],
  exports: [LeadsService, EnrichmentService],
})
export class LeadsModule {}
