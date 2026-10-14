import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { AttachmentService } from "./attachment.service";
import { BaileysProvider } from "./baileys.provider";
import { FollowUpService } from "./followup.service";
import { InboundService } from "./inbound.service";
import { ReclassifyService } from "./reclassify.service";
import { MessageWriterService } from "./message-writer.service";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { SenderService } from "./sender.service";
import { TemplateController } from "./template.controller";
import { TemplateService } from "./template.service";
import { WHATSAPP_PROVIDER } from "./whatsapp.provider";
import { WhatsappGateway } from "./whatsapp.gateway";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [MessagingController, TemplateController],
  providers: [
    BaileysProvider,
    WhatsappGateway,
    { provide: WHATSAPP_PROVIDER, useExisting: WhatsappGateway },
    AttachmentService,
    MessageWriterService,
    MessagingService,
    TemplateService,
    SenderService,
    InboundService,
    ReclassifyService,
    FollowUpService,
  ],
})
export class MessagingModule {}
