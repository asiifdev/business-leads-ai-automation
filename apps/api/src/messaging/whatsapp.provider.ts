export type WaStatus = "disconnected" | "connecting" | "qr" | "connected" | "logged_out";

/** A message the owner typed on their own phone or WhatsApp Web (not sent by Prospex). */
export type OwnWhatsappMessage = InboundWhatsappMessage;

export interface InboundWhatsappMessage {
  phone: string;
  text: string;
  id: string;
  at: Date;
}

/** What can go with a message besides its text. A provider that cannot send these must refuse, never drop them silently. */
export interface SendExtras {
  /** A file sent with the text as its caption. */
  attachment?: { data: Buffer; mimeType: string; fileName: string; kind: "image" | "video" | "document" };
  /** The card shown under a link in the text (ignored when a file is attached: WhatsApp shows no card on a caption). */
  linkPreview?: { url: string; title: string; description: string; thumbnail?: Buffer };
}

/** Thrown when the account is not connected right now. The sender puts the message back in the queue instead of failing it. */
export class ProviderUnavailableError extends Error {}

/**
 * One interface for every way of reaching WhatsApp. Baileys (linked device) is implemented;
 * the official Cloud API can be added as a second provider without touching the queue or the sender.
 */
export interface WhatsappProvider {
  connect(workspaceId: string): Promise<void>;
  disconnect(workspaceId: string, opts?: { logout?: boolean }): Promise<void>;
  state(workspaceId: string): { status: WaStatus; qr: string | null; phone: string | null };
  /** Returns the address to send to, or null when the number is not on WhatsApp. */
  resolve(workspaceId: string, phone: string): Promise<string | null>;
  /** Shows "typing…" for `typingMs`, then sends one text message. Returns the provider message id. */
  send(workspaceId: string, to: string, text: string, typingMs: number, extras?: SendExtras): Promise<string>;
  onInbound(handler: (workspaceId: string, msg: InboundWhatsappMessage) => Promise<void>): void;
  /** Optional: told about messages the owner sends from their phone, so the conversation is complete. */
  onOwnMessage?(handler: (workspaceId: string, msg: OwnWhatsappMessage) => Promise<void>): void;
}

export type WhatsappProviderName = "baileys" | "cloud_api";

/** What the rest of the app talks to: one provider per workspace, chosen by the workspace's connection type. */
export interface RoutedWhatsappProvider extends WhatsappProvider {
  use(workspaceId: string, name: WhatsappProviderName | string): void;
  hasCloud(): boolean;
}

export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");
