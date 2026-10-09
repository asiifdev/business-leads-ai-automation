import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

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
  private openai: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: this.config.get<string>("OPENAI_BASE_URL") || undefined,
      });
    }
  }

  /** Returns null when no model is available or it fails: we never store canned text that looks like a real draft. */
  async generateContent(input: GenerateContentInput): Promise<MarketingContent | null> {
    if (!this.openai) return null;
    try {
      return await this.callOpenAI(input);
    } catch (err) {
      this.logger.error("Content generation failed", err);
      return null;
    }
  }

  private async callOpenAI(input: GenerateContentInput): Promise<MarketingContent> {
    const model = this.config.get<string>("OPENAI_MODEL") || "gpt-4o-mini";
    const isIndonesian = input.language === "indonesian";
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
Language: ${isIndonesian ? "Indonesian (Bahasa Indonesia)" : "English"}
AI Score: ${input.score}/100

Generate: email (subject + body, 100-150 words), LinkedIn connection note (under 280 chars), cold call opening (2-3 sentences).

Be specific to this business. Mention their name, rating, location.

Respond ONLY with valid JSON:
{
  "email": { "subject": "...", "body": "..." },
  "linkedin": { "connectionNote": "..." },
  "coldCall": { "opening": "..." }
}`;

    const response = await this.openai!.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0].message.content!) as Omit<MarketingContent, "source">;
    return { ...parsed, source: "llm" };
  }
}
