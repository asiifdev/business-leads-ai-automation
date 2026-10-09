export type WaStatus = "disconnected" | "connecting" | "qr" | "connected" | "logged_out";

export interface InboundWhatsappMessage {
  phone: string;
  text: string;
  id: string;
  at: Date;
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
  send(workspaceId: string, to: string, text: string, typingMs: number): Promise<string>;
  onInbound(handler: (workspaceId: string, msg: InboundWhatsappMessage) => Promise<void>): void;
}

export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");
