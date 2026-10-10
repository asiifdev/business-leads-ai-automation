import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { MessageWriterService } from "../messaging/message-writer.service";
import { EmailController } from "./email.controller";
import { EmailSenderService } from "./email-sender.service";
import { EmailService } from "./email.service";
import { UnsubscribeController } from "./unsubscribe.controller";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [EmailController, UnsubscribeController],
  providers: [EmailService, EmailSenderService, MessageWriterService],
})
export class EmailModule {}
