import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EntitlementsController } from "./entitlements.controller";
import { EntitlementsService } from "./entitlements.service";

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
