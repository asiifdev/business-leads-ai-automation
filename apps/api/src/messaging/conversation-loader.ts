import { PrismaService } from "../prisma/prisma.service";
import { OPT_OUT_HINT_EN, OPT_OUT_HINT_ID } from "./opt-out";
import { analyzeConversation, type ConversationMessage, type ConversationState } from "./thread";

export interface LoadedConversation extends ConversationState {
  /** Our last WhatsApp message to them, from Prospex or from the owner's phone, without the opt-out line. */
  lastMine: string;
  /** Both sides in order (the last 15 of ours, the last 20 of theirs), with a shop's automatic messages marked. */
  timeline: ConversationMessage[];
  /** Everything they wrote (up to 20 messages), with the label each was given when it arrived. */
  replies: { id: string; body: string; intent: string | null }[];
}

const plain = (t: string) => t.replace(OPT_OUT_HINT_ID, "").replace(OPT_OUT_HINT_EN, "").trim();

/**
 * The whole WhatsApp conversation with one lead: what Prospex sent, what the owner typed on their phone (stored as source
 * "external"), and what the lead wrote, with a shop's automatic messages marked. One place, so receiving a message, writing a
 * draft and re-reading the pipeline all see the same conversation.
 */
export async function loadConversation(prisma: PrismaService, workspaceId: string, leadId: string, phone: string, latest = ""): Promise<LoadedConversation> {
  const [out, inn] = await Promise.all([
    prisma.outboundMessage.findMany({ where: { workspaceId, leadId, channel: "whatsapp", status: "sent" }, orderBy: { sentAt: "desc" }, take: 15, select: { body: true, sentAt: true } }),
    prisma.inboundMessage.findMany({ where: { workspaceId, fromPhone: phone }, orderBy: { receivedAt: "desc" }, take: 20, select: { id: true, body: true, receivedAt: true, intent: true } }),
  ]);
  const lines: ConversationMessage[] = [
    ...out.map((m) => ({ at: m.sentAt!.getTime(), mine: true, text: plain(m.body) })),
    ...inn.map((m) => ({ at: m.receivedAt.getTime(), mine: false, text: m.body, auto: m.intent === "auto_reply" })),
  ];
  return { ...analyzeConversation(lines, latest), lastMine: out[0] ? plain(out[0].body) : "", timeline: lines, replies: inn.map((m) => ({ id: m.id, body: m.body, intent: m.intent })) };
}
