export type WaStatus = "disconnected" | "connecting" | "qr" | "connected" | "logged_out";

export interface Overview {
  account: {
    status: WaStatus; phone: string | null; hourlyLimit: number; dailyLimit: number; quietStartHour: number; quietEndHour: number;
    timezone: string; defaultCountryCode: string; paused: boolean; lastError: string | null; nextSendAt: string | null;
  };
  qr: string | null;
  provider: "baileys" | "cloud_api";
  cloudApi: { entitled: boolean; installed: boolean; edition: "community" | "hosted" };
  usage: { sentLastHour: number; sentToday: number; drafts: number; approved: number };
  unsubscribeReady?: boolean;
  quietNow: boolean;
  etaHours: number | null;
}

export interface OutboxMessage {
  id: string; channel: "whatsapp" | "email"; toPhone: string; toEmail: string | null; subject: string | null; body: string; aiBody: string | null; source: "ai_outreach" | "ai_reply" | "ai_followup" | "manual" | "external";
  status: "draft" | "approved" | "sending" | "sent" | "failed" | "rejected" | "cancelled";
  editedByUser: boolean; error: string | null; sentAt: string | null; createdAt: string;
  context: { incoming?: string; flagged?: boolean; risks?: string[]; followUp?: number; trace?: { styled: boolean; examples: number; knowledge: string } } | null;
  lead: { id: string; name: string; category: string | null; address: string | null; score: number; crmStatus: string } | null;
  attachment?: { id: string; fileName: string; mimeType: string; sizeBytes: number } | null;
  linkPreview?: { url: string; title: string; description: string; thumbnail?: string } | null;
}

export interface GenerationJob {
  running: boolean; total: number; done: number; created: number; failed: number;
  /** Reasons leads were left out: noValidPhone, optedOut, duplicateNumber, lowQuality, notOnWhatsapp (WhatsApp) or noEmail, optedOut, duplicateAddress, lowQuality, badEmail (email). */
  skipped: Record<string, number>; firstError: string | null;
}

export type Counts = Record<string, number>;

export interface EmailOverview {
  account: {
    host: string; port: number; secure: boolean; username: string; hasPassword: boolean; fromName: string; fromEmail: string; replyTo: string | null; postalAddress: string; ctaUrl: string | null;
    hourlyLimit: number; dailyLimit: number; quietStartHour: number; quietEndHour: number; timezone: string; paused: boolean;
    status: "untested" | "ready" | "error"; lastError: string | null; verifiedAt: string | null;
  } | null;
  usage: { sentLastHour: number; sentToday: number; drafts: number; approved: number; leadsWithEmail: number };
  unsubscribeReady: boolean;
  quietNow: boolean;
  etaHours: number | null;
}
