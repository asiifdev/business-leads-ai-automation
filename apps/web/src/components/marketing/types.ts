export interface Source {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  status: "processing" | "ready" | "failed";
  error: string | null;
  chunkCount: number;
  chars: number;
  pages: number;
  readable: boolean;
  progress: { stage: "reading" | "indexing"; pages?: number; discovered?: number } | null;
  createdAt: string;
}

export interface BriefContent {
  overview: { oneLiner: string; whatItDoes: string; category: string; businessModel: string };
  audience: { targetCustomers: string; decisionMakers: string; primaryUseCase: string; jobsToBeDone: string[] };
  problems: { coreProblem: string; whyAlternativesFallShort: string[]; cost: string };
  differentiation: { keyDifferentiators: string[]; whyBetter: string };
  objections: { objection: string; response: string }[];
  proof: { metrics: string[]; customers: string[]; testimonials: string[] };
  offer: { pricing: string; callToAction: string };
  voice: { tone: string; wordsToUse: string[]; wordsToAvoid: string[] };
  angles: { segment: string; pain: string; hook: string; benefit: string }[];
  gaps: string[];
}

export interface CampaignSuggestion {
  name: string;
  target: string;
  location: string;
  searchQueries: string[];
  contentStyle: "professional" | "friendly" | "balanced" | "casual";
  language: "indonesian" | "english";
}

export interface Brief {
  version: number;
  language: string;
  summary: string;
  content: BriefContent;
  campaign?: CampaignSuggestion;
  pagesRead: { title: string; url: string }[];
  sources: { id: string; title: string; url: string | null }[];
  updatedAt: string;
}

export type BriefResponse = Brief | { exists: false };
export const hasBrief = (b: BriefResponse | null): b is Brief => !!b && !("exists" in b);
