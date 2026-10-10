import { Module } from "@nestjs/common";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { EnrichmentService } from "./enrichment.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [LeadsController],
  providers: [LeadsService, EnrichmentService],
  exports: [LeadsService],
})
export class LeadsModule {}
