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
  quietNow: boolean;
  etaHours: number | null;
}

export interface OutboxMessage {
  id: string; toPhone: string; body: string; aiBody: string | null; source: "ai_outreach" | "ai_reply" | "ai_followup" | "manual";
  status: "draft" | "approved" | "sending" | "sent" | "failed" | "rejected" | "cancelled";
  editedByUser: boolean; error: string | null; sentAt: string | null; createdAt: string;
  context: { incoming?: string; flagged?: boolean; risks?: string[]; followUp?: number; trace?: { styled: boolean; examples: number; knowledge: string } } | null;
  lead: { id: string; name: string; category: string | null; address: string | null; score: number; crmStatus: string } | null;
}

export interface GenerationJob {
  running: boolean; total: number; done: number; created: number; failed: number;
  skipped: { noValidPhone: number; optedOut: number; duplicateNumber: number }; firstError: string | null;
}

export type Counts = Record<string, number>;
