import { Injectable } from "@nestjs/common";

interface LeadData {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: string;
  reviewCount?: number | null;
  hasWebsite?: boolean;
  referenceUrl?: string;
  lat?: number | null;
  lng?: number | null;
  industry?: string;
}

export interface LeadIntelligence {
  score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  factors: string[];
  recommendation: string;
}

@Injectable()
export class LeadIntelligenceService {
  private readonly INDUSTRY_SCORES: Record<string, number> = {
    restaurant: 85, cafe: 90, retail: 75, automotive: 80, healthcare: 85,
    beauty: 80, education: 75, realestate: 85, event: 80, tech: 90,
    professional: 85, hotel: 80, spa: 78, gym: 75,
  };

  private readonly CITY_SCORES: Record<string, number> = {
    jakarta: 95, surabaya: 85, bandung: 80, medan: 75, yogyakarta: 78,
    semarang: 72, makassar: 70, palembang: 68, pekanbaru: 65, denpasar: 85,
  };

  scoreLead(lead: LeadData, targetIndustry?: string): LeadIntelligence {
    let score = 50;
    const factors: string[] = [];

    if (lead.phone) { score += 10; factors.push("Has phone number"); }
    if (lead.website || lead.hasWebsite) { score += 10; factors.push("Has website"); }
    if (lead.address) { score += 5; factors.push("Has address"); }

    const rawRating = parseFloat(lead.rating ?? "0");
    if (rawRating > 0) {
      // Bayesian average: pulls the rating toward a neutral prior (4.0★, worth
      // PRIOR_WEIGHT "reviews") so a 5★/1-review lead can't outrank a 4.5★/thousands
      // -review lead just because it has fewer, noisier ratings.
      const PRIOR_MEAN = 4.0;
      const PRIOR_WEIGHT = 25;
      const n = lead.reviewCount ?? 1; // unknown count treated as low-confidence (1 review)
      const rating = (PRIOR_WEIGHT * PRIOR_MEAN + n * rawRating) / (PRIOR_WEIGHT + n);

      if (rating >= 4.5) score += 15;
      else if (rating >= 4.0) score += 10;
      else if (rating >= 3.5) score += 5;

      const countLabel = lead.reviewCount != null ? ` (${lead.reviewCount} reviews)` : "";
      factors.push(`Rating: ${rawRating}★${countLabel}`);

      if ((lead.reviewCount ?? 0) >= 100) { score += 5; factors.push("Well-established (100+ reviews)"); }
      else if ((lead.reviewCount ?? 0) >= 20) { score += 2; factors.push("Established (20+ reviews)"); }
    }

    const industryKey = (targetIndustry || lead.industry || "").toLowerCase().replace(/[^a-z]/g, "");
    const industryScore = this.INDUSTRY_SCORES[industryKey];
    if (industryScore) {
      const bonus = (industryScore - 50) / 5;
      score += bonus;
      factors.push(`High-value industry: ${targetIndustry || lead.industry}`);
    }

    const addressLower = (lead.address || "").toLowerCase();
    for (const [city, cityScore] of Object.entries(this.CITY_SCORES)) {
      if (addressLower.includes(city)) {
        score += (cityScore - 50) / 10;
        factors.push(`Prime location: ${city}`);
        break;
      }
    }

    if (!lead.hasWebsite && !lead.website) {
      score += 5;
      factors.push("No website (digital gap opportunity)");
    }

    score = Math.min(100, Math.max(0, Math.round(score)));
    const priority: "HIGH" | "MEDIUM" | "LOW" = score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : "LOW";
    const category = targetIndustry || lead.industry || "General Business";

    let recommendation = "";
    if (priority === "HIGH") recommendation = `High-value ${category} business. Prioritize outreach immediately.`;
    else if (priority === "MEDIUM") recommendation = `Moderate potential. Include in standard outreach sequence.`;
    else recommendation = `Lower priority. Contact only if capacity allows.`;

    return { score, priority, category, factors, recommendation };
  }

  scoreLeads(leads: LeadData[], targetIndustry?: string): Array<LeadData & LeadIntelligence> {
    return leads
      .map((lead) => ({ ...lead, ...this.scoreLead(lead, targetIndustry) }))
      .sort((a, b) => b.score - a.score);
  }
}
