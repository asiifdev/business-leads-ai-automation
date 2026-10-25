import { languageName } from "../common/language";
import { Injectable, Logger } from "@nestjs/common";
import { AiClientService, WorkspaceAi } from "./ai-client.service";

export interface GenerateContentInput {
  businessName: string;
  address?: string;
  industry: string;
  rating?: string;
  hasWebsite?: boolean;
  yourService: string;
  contentStyle: string;
  language: string;
  score: number;
}

/**
 * WhatsApp and Instagram messages are no longer written here: they come from the draft engine
 * (owner's voice + knowledge base) and wait for approval in the Outbox. `source` marks content written by a model.
 */
export interface MarketingContent {
  email: { subject: string; body: string };
  linkedin: { connectionNote: string };
  coldCall: { opening: string };
  source: "llm";
}

@Injectable()
export class MarketingAiService {
  private readonly logger = new Logger(MarketingAiService.name);
  constructor(private readonly aiClient: AiClientService) {}

  /** Returns null when no model is available or it fails: we never store canned text that looks like a real draft. */
  async generateContent(workspaceId: string, input: GenerateContentInput): Promise<MarketingContent | null> {
    const ai = await this.aiClient.forWorkspace(workspaceId);
    if (!ai.enabled) return null;
    try {
      return await this.callModel(ai, input);
    } catch (err) {
      this.logger.error("Content generation failed", err);
      return null;
    }
  }

  private async callModel(ai: WorkspaceAi, input: GenerateContentInput): Promise<MarketingContent> {
    const styleCues: Record<string, string> = {
      professional: "formal, professional, direct",
      friendly: "warm, friendly, approachable",
      casual: "casual, relaxed, conversational",
      balanced: "balanced, friendly yet professional",
    };
    const style = styleCues[input.contentStyle] || "balanced";

    const prompt = `Generate personalized outreach content for this business lead.

Business: ${input.businessName}
Industry: ${input.industry}
Address: ${input.address || "unknown"}
Rating: ${input.rating || "unknown"} stars
Has Website: ${input.hasWebsite ? "yes" : "no"}
Your Service/Product: ${input.yourService}
Tone: ${style}
Language: ${languageName(input.language)} (write every field in this language)
AI Score: ${input.score}/100

Generate: email (subject + body, 100-150 words), LinkedIn connection note (under 280 chars), cold call opening (2-3 sentences).

Be specific to this business. Mention their name, rating, location.

Respond ONLY with valid JSON:
{
  "email": { "subject": "...", "body": "..." },
  "linkedin": { "connectionNote": "..." },
  "coldCall": { "opening": "..." }
}`;

    const reply = await ai.chat([{ role: "user", content: prompt }], { json: true, temperature: 0.7 });
    const parsed = JSON.parse(reply) as Omit<MarketingContent, "source">;
    return { ...parsed, source: "llm" };
  }
}
