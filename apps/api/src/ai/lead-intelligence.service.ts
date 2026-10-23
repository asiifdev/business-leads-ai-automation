import { Injectable } from "@nestjs/common";
import { normalizeRating } from "../scraper/maps-parse";

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
  /** The category Google Maps shows for the place. */
  category?: string;
}

export type FitLevel = "high" | "medium" | "low";
export interface FitVerdict {
  fit: FitLevel;
  reason: string;
}

export interface LeadIntelligence {
  score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  /** The real Google Maps category when known, otherwise the campaign's target label. */
  category: string;
  factors: string[];
  recommendation: string;
  fit?: FitVerdict;
}

/**
 * A ranking aid, not a prediction. The index uses only signals that come from the scraped listing (reachability,
 * rating, review volume) plus one judgement: how well the business's real Maps category matches the offer, decided
 * from the user's Marketing Brief (see FitService). There are no hard-coded industry or city weights: those were
 * guesses with no data behind them.
 *
 *   30 base
 *   +15 phone (we can reach them)   +3 address
 *   +5/+10/+15 Bayesian rating (3.5 / 4.0 / 4.5)
 *   +2/+5/+10 reviews (5 / 20 / 100)
 *   +20 high fit, +8 medium fit, -15 low fit (0 when fit was not assessed)
 * HIGH from 70, MEDIUM from 50.
 */
@Injectable()
export class LeadIntelligenceService {
  scoreLead(lead: LeadData, fit?: FitVerdict): LeadIntelligence {
    let score = 30;
    const factors: string[] = [];

    if (lead.phone) { score += 15; factors.push("Has a phone number"); } else factors.push("No phone number: cannot be reached on WhatsApp");
    if (lead.address) score += 3;

    const rawRating = parseFloat(normalizeRating(lead.rating) || "0");
    if (rawRating > 0) {
      // Bayesian average: pulls the rating toward a neutral prior (4.0, worth PRIOR_WEIGHT reviews) so a
      // 5.0 with 1 review cannot outrank a 4.5 with thousands just because it has fewer, noisier ratings.
      const PRIOR_MEAN = 4.0;
      const PRIOR_WEIGHT = 25;
      const n = lead.reviewCount ?? 1;
      const rating = (PRIOR_WEIGHT * PRIOR_MEAN + n * rawRating) / (PRIOR_WEIGHT + n);
      if (rating >= 4.5) score += 15;
      else if (rating >= 4.0) score += 10;
      else if (rating >= 3.5) score += 5;
      factors.push(`Rating ${rawRating}${lead.reviewCount != null ? ` from ${lead.reviewCount} reviews` : ""}`);
    }
    const reviews = lead.reviewCount ?? 0;
    if (reviews >= 100) score += 10;
    else if (reviews >= 20) score += 5;
    else if (reviews >= 5) score += 2;

    if (fit) {
      score += fit.fit === "high" ? 20 : fit.fit === "medium" ? 8 : -15;
      factors.push(`Fit with your offer: ${fit.fit}${fit.reason ? ` (${fit.reason})` : ""}`);
    } else {
      factors.push("Fit with your offer was not assessed");
    }
    if (!lead.website && !lead.hasWebsite) factors.push("No website listed");

    score = Math.min(100, Math.max(0, Math.round(score)));
    const priority: "HIGH" | "MEDIUM" | "LOW" = score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";
    const category = lead.category || lead.industry || "General Business";

    const recommendation =
      fit?.reason ||
      (priority === "HIGH" ? "Reachable, well reviewed. Worth contacting first." : priority === "MEDIUM" ? "Moderate signals. Include in the standard sequence." : "Weaker signals. Contact only if capacity allows.");
    return { score, priority, category, factors, recommendation, fit };
  }

  /** Scores and sorts. `fits[i]` is the fit verdict for `leads[i]` (or undefined when it was not assessed). */
  scoreLeads<T extends LeadData>(leads: T[], fits: (FitVerdict | undefined)[] = []): Array<T & LeadIntelligence> {
    return leads
      .map((lead, i) => ({ ...lead, ...this.scoreLead(lead, fits[i]) }))
      .sort((a, b) => b.score - a.score);
  }
}
