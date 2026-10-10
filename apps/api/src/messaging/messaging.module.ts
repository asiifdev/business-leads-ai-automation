import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { BaileysProvider } from "./baileys.provider";
import { FollowUpService } from "./followup.service";
import { InboundService } from "./inbound.service";
import { MessageWriterService } from "./message-writer.service";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { SenderService } from "./sender.service";
import { WHATSAPP_PROVIDER } from "./whatsapp.provider";
import { WhatsappGateway } from "./whatsapp.gateway";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [MessagingController],
  providers: [
    BaileysProvider,
    WhatsappGateway,
    { provide: WHATSAPP_PROVIDER, useExisting: WhatsappGateway },
    MessageWriterService,
    MessagingService,
    SenderService,
    InboundService,
    FollowUpService,
  ],
})
export class MessagingModule {}
