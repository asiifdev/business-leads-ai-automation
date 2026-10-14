import { classifyReply, type ReplyIntent } from "./reply-intent";
import type { ConversationMessage } from "./thread";

export interface Peak {
  /** The strongest stage their words honestly reached: a meeting, interest, or a plain reply; null when a person never wrote. */
  stage: "meeting" | "interested" | "replied" | null;
  /** What each of their bubbles meant when it was written, read against what we had asked just before it. */
  intents: ReplyIntent[];
}

/**
 * Reads the whole conversation bubble by bubble, each against the message of ours right before it, and returns the highest
 * stage it ever honestly reached. A later "Ok" does not undo an earlier meeting, and a "Boleh" to an offer of an example is
 * interest and not a meeting. Rules only: no model, so the result is the same every time.
 */
export function peakOfConversation(timeline: ConversationMessage[]): Peak {
  const sorted = [...timeline].sort((a, b) => a.at - b.at);
  let lastMine = "";
  const intents: ReplyIntent[] = [];
  for (const m of sorted) {
    if (m.mine) { lastMine = m.text; continue; }
    if (m.auto) continue;
    const intent = classifyReply(m.text, { lastMine });
    if (intent !== "auto_reply") intents.push(intent);
  }
  if (!intents.length) return { stage: null, intents };
  if (intents.includes("meeting")) return { stage: "meeting", intents };
  if (intents.includes("interested")) return { stage: "interested", intents };
  return { stage: "replied", intents };
}
