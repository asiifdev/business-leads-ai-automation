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

export interface MarketingContent {
  email: { subject: string; body: string };
  whatsapp: string;
  instagram: string;
  linkedin: { connectionNote: string };
  coldCall: { opening: string };
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

  async generateContent(input: GenerateContentInput): Promise<MarketingContent> {
    if (!this.openai) return this.generateMockContent(input);
    try {
      return await this.callOpenAI(input);
    } catch (err) {
      this.logger.error("OpenAI generation failed, using mock content", err);
      return this.generateMockContent(input);
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

Generate: email (subject + body, 100-150 words), WhatsApp (50-80 words, can use emoji), Instagram DM (40-60 words), LinkedIn connection note (under 280 chars), cold call opening (2-3 sentences).

Be specific to this business. Mention their name, rating, location.

Respond ONLY with valid JSON:
{
  "email": { "subject": "...", "body": "..." },
  "whatsapp": "...",
  "instagram": "...",
  "linkedin": { "connectionNote": "..." },
  "coldCall": { "opening": "..." }
}`;

    const response = await this.openai!.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content!) as MarketingContent;
  }

  generateMockContent(input: GenerateContentInput): MarketingContent {
    const isId = input.language === "indonesian";
    const name = input.businessName;
    const service = input.yourService;
    const ratingTag = input.rating ? ` dengan rating ${input.rating} bintang` : "";
    const ratingTagEn = input.rating ? ` with a ${input.rating}-star rating` : "";

    if (isId) {
      return {
        email: {
          subject: `Tingkatkan bisnis ${name} dengan ${service}`,
          body: `Halo tim ${name},\n\nSaya melihat bisnis Anda${ratingTag} — sangat impressive!\n\nSaya ingin berbagi bagaimana ${service} bisa membantu ${name} tumbuh lebih cepat dan melayani pelanggan lebih baik.\n\nApakah ada waktu 15 menit untuk berdiskusi?\n\nSalam,\n[Nama Anda]`,
        },
        whatsapp: `Halo ${name}! 👋\n\nSaya lihat bisnis Anda${input.rating ? ` rating ${input.rating}⭐` : ""} — keren!\n\nMau tau gimana ${service} bisa bantu ${name} makin berkembang? 🚀\n\nBoleh chat sebentar?`,
        instagram: `Hi ${name}! Bisnis kalian${input.rating ? ` rating ${input.rating}⭐` : ""} keren banget 🔥 Penasaran gimana ${service} bisa bantu bisnis kalian makin sukses. Yuk DM! ✨`,
        linkedin: { connectionNote: `Halo, saya tertarik dengan ${name}. Saya bergerak di bidang ${service} dan ingin berdiskusi tentang potensi kolaborasi.` },
        coldCall: { opening: `Selamat pagi, boleh berbicara dengan pemilik ${name}? Saya ingin berbagi bagaimana ${service} bisa membantu pertumbuhan ${name}.` },
      };
    }

    return {
      email: {
        subject: `Grow ${name} with ${service}`,
        body: `Hi ${name} team,\n\nI came across your business${ratingTagEn} — impressive work!\n\nI'd love to share how ${service} could help ${name} serve more customers and grow faster.\n\nWould you have 15 minutes for a quick chat?\n\nBest,\n[Your Name]`,
      },
      whatsapp: `Hi ${name}! 👋\n\nSaw your business${input.rating ? ` rated ${input.rating}⭐` : ""} — great work!\n\nWant to see how ${service} can help ${name} grow? 🚀\n\nQuick chat?`,
      instagram: `Hi ${name}! Love what you're doing${input.rating ? ` (${input.rating}⭐!)` : ""} 🔥 I think ${service} could take your business to the next level. DM me! ✨`,
      linkedin: { connectionNote: `Hi, I noticed ${name} and would love to connect. I specialize in ${service} and see great potential for collaboration.` },
      coldCall: { opening: `Hi, may I speak with the owner of ${name}? I'd love to share how ${service} could help grow ${name}.` },
    };
  }
}
