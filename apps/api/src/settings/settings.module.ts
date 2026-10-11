import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
