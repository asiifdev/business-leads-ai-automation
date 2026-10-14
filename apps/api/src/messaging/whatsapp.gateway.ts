import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { PrismaService } from "../prisma/prisma.service";
import { BaileysProvider } from "./baileys.provider";
import { loadCloudProvider } from "./cloud-plugin";
import { ProviderUnavailableError, type InboundWhatsappMessage, type OwnWhatsappMessage, type SendExtras, type RoutedWhatsappProvider, type WhatsappProvider, type WhatsappProviderName } from "./whatsapp.provider";

/**
 * Routes each workspace to the connection type it chose: a linked device (Baileys, always available) or the official
 * WhatsApp Cloud API (only in the hosted edition, only on a plan that includes it, only if the commercial connector is
 * installed). Everything else in the app talks to this one object.
 */
@Injectable()
export class WhatsappGateway implements RoutedWhatsappProvider, OnModuleInit {
  private readonly logger = new Logger(WhatsappGateway.name);
  private readonly names = new Map<string, WhatsappProviderName>();
  private cloud: WhatsappProvider | null = null;
  private handler: ((workspaceId: string, msg: InboundWhatsappMessage) => Promise<void>) | null = null;

  constructor(
    private readonly baileys: BaileysProvider,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async onModuleInit() {
    if (this.entitlements.edition === "hosted") {
      this.cloud = loadCloudProvider({ prisma: this.prisma, config: this.config });
      this.logger.log(this.cloud ? "Official WhatsApp connector loaded" : "Official WhatsApp connector is not installed");
      if (this.cloud && this.handler) this.cloud.onInbound(this.handler);
    }
    const accounts = await this.prisma.whatsappAccount.findMany({ select: { workspaceId: true, provider: true } }).catch(() => []);
    accounts.forEach((a) => this.names.set(a.workspaceId, a.provider === "cloud_api" ? "cloud_api" : "baileys"));
  }

  /** Whether the commercial connector is installed on this server (not whether a workspace may use it). */
  hasCloud(): boolean {
    return this.cloud !== null;
  }

  use(workspaceId: string, name: WhatsappProviderName | string): void {
    this.names.set(workspaceId, name === "cloud_api" ? "cloud_api" : "baileys");
  }

  private pick(workspaceId: string): WhatsappProvider {
    if (this.names.get(workspaceId) === "cloud_api") {
      if (!this.cloud) throw new ProviderUnavailableError("The official WhatsApp connector is not installed on this server");
      return this.cloud;
    }
    return this.baileys;
  }

  onInbound(handler: (workspaceId: string, msg: InboundWhatsappMessage) => Promise<void>) {
    this.handler = handler;
    this.baileys.onInbound(handler);
    this.cloud?.onInbound(handler);
  }

  onOwnMessage(handler: (workspaceId: string, msg: OwnWhatsappMessage) => Promise<void>) {
    this.baileys.onOwnMessage(handler);
    this.cloud?.onOwnMessage?.(handler);
  }

  state(workspaceId: string) {
    try {
      return this.pick(workspaceId).state(workspaceId);
    } catch {
      return { status: "disconnected" as const, qr: null, phone: null };
    }
  }
  async connect(workspaceId: string) { return this.pick(workspaceId).connect(workspaceId); }
  async disconnect(workspaceId: string, opts?: { logout?: boolean }) { return this.pick(workspaceId).disconnect(workspaceId, opts); }
  async resolve(workspaceId: string, phone: string) { return this.pick(workspaceId).resolve(workspaceId, phone); }
  async send(workspaceId: string, to: string, text: string, typingMs: number, extras?: SendExtras) {
    // the official connector has not been taught to send files or link cards: refuse rather than send the text alone
    if ((extras?.attachment || extras?.linkPreview) && this.names.get(workspaceId) === "cloud_api") throw new Error("Attachments and link previews are only supported on a linked-device connection");
    return this.pick(workspaceId).send(workspaceId, to, text, typingMs, extras);
  }
}
