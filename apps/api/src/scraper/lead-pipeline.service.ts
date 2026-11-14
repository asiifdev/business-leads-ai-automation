import { Injectable, Logger } from "@nestjs/common";
import { CampaignsService } from "../campaigns/campaigns.service";
import { LeadsService } from "../leads/leads.service";
import { LeadIntelligenceService } from "../ai/lead-intelligence.service";
import { GeoService } from "../leads/geo.service";
import { EnrichmentService } from "../leads/enrichment.service";
import { FitService } from "../ai/fit.service";
import { MarketingAiService } from "../ai/marketing-ai.service";
import type { RawSourceLead } from "./sources/lead-source";
import type { LeadFill } from "./lead-collector.service";
import { leadKey } from "./lead-key";

/** Notes for top leads are written this many at a time. */
const NOTE_CONCURRENCY = 4;

/** `Promise.all(items.map(fn))` with at most `limit` running at once; the results keep the order of `items`. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}

export interface PipelineJob {
  campaignId: string;
  workspaceId: string;
  industry: string;
  yourService: string;
  contentStyle: string;
  language: string;
}

/**
 * What happens to leads once they are found, wherever they came from (a scrape, OpenStreetMap, an imported file): fit judgement,
 * score, notes for the best ones, saving with the data-trust marks, the campaign's totals, areas and contact enrichment.
 */
@Injectable()
export class LeadPipelineService {
  private readonly logger = new Logger(LeadPipelineService.name);

  constructor(
    private campaigns: CampaignsService,
    private leads: LeadsService,
    private leadIntelligence: LeadIntelligenceService,
    private marketingAi: MarketingAiService,
    private fit: FitService,
    private enrichment: EnrichmentService,
    private geo: GeoService,
  ) {}

  /**
   * Fit, score and notes for top leads, ready to store. `quiet` leaves the campaign's progress alone (used for the batches stored while the
   * search is still running).
   */
  private async prepare(job: PipelineJob, raw: RawSourceLead[], o: { from: number; quiet?: boolean }) {
    const { campaignId, workspaceId } = job;
    const { from } = o;
    const total = raw.length;
    const status = (pct: number) => (o.quiet ? Promise.resolve() : this.campaigns.updateStatus(campaignId, "running", pct).then(() => undefined));

    // Fit is judged per business from its name and real category, against the offer and the Marketing Brief (needs an AI provider).
    const fits = await this.fit.assess(workspaceId, raw.map((l) => ({ name: l.name, category: l.category })), job.yourService, job.language);
    const scored = this.leadIntelligence.scoreLeads(raw, fits);
    await status(Math.max(from, 60));

    const processed = await mapLimit(scored, NOTE_CONCURRENCY, async (lead, i) => {
        let marketingContent = null;
        if (lead.priority === "HIGH") {
          try {
            marketingContent = await this.marketingAi.generateContent(workspaceId, {
              businessName: lead.name,
              address: lead.address,
              industry: job.industry,
              rating: lead.rating,
              hasWebsite: lead.hasWebsite,
              yourService: job.yourService,
              contentStyle: job.contentStyle,
              language: job.language,
              score: lead.score,
            });
          } catch (e) {
            this.logger.warn(`Content gen failed for ${lead.name}: ${e}`);
          }
        }
        if (i % 5 === 0) await status(60 + Math.round((i / Math.max(total, 1)) * 35));
        return {
          name: lead.name,
          address: lead.address,
          phone: lead.phone,
          website: lead.website,
          email: lead.email || undefined,
          rating: lead.rating,
          reviewCount: lead.reviewCount ?? undefined,
          hasWebsite: lead.hasWebsite ?? false,
          referenceUrl: lead.referenceUrl,
          source: lead.source,
          fieldSources: lead.fieldSources,
          social: lead.social,
          lat: lead.lat ?? undefined,
          lng: lead.lng ?? undefined,
          score: lead.score,
          priority: lead.priority,
          category: lead.category || undefined,
          businessStatus: lead.businessStatus ?? null,
          aiAnalysis: { factors: lead.factors, recommendation: lead.recommendation, ...(lead.fit ? { fit: lead.fit } : {}) },
          marketingContent: marketingContent ?? undefined,
          campaignId,
          workspaceId,
        };
    });

    return processed;
  }

  /**
   * Stores a batch while the search is still running, so what was found survives a restart and shows up in the campaign at once.
   * Returns the stored ids in the order of `raw`. A lead this campaign already stored (a run that started again after a restart) is not saved twice.
   */
  async saveBatch(job: PipelineJob, raw: RawSourceLead[]): Promise<string[]> {
    const known = await this.leads.campaignLeadKeys(job.campaignId);
    const fresh = raw.filter((l) => !known.has(leadKey(l)));
    let ids: string[] = [];
    if (fresh.length) {
      const processed = await this.prepare(job, fresh, { from: 0, quiet: true });
      ids = (await this.leads.createMany(processed)).ids;
      await this.campaigns.refreshStats(job.campaignId);
      this.geo.start(job.workspaceId);
      this.logger.log(`Campaign ${job.campaignId}: ${fresh.length} leads saved so far`);
    }
    const fresher = new Map(fresh.map((l, i) => [l, ids[i]]));
    return raw.map((l) => fresher.get(l) ?? known.get(leadKey(l)) ?? "");
  }

  /** Writes what later sources added to leads that were already stored. */
  async applyFills(fills: LeadFill[]) {
    if (!fills.length) return { filled: 0 };
    const r = await this.leads.applyFills(fills as Parameters<LeadsService["applyFills"]>[0]);
    this.logger.log(`${r.filled} stored leads completed with details from a later source`);
    return r;
  }

  /**
   * `from` is the progress already reached (0..100) when the leads arrive. Stores what is not stored yet, then marks the campaign completed,
   * with `note` as its message. `savedEarly` is how many leads batches stored before this point.
   */
  async ingest(job: PipelineJob, raw: RawSourceLead[], opts: { from?: number; note?: string; savedEarly?: number } = {}): Promise<{ saved: number }> {
    const { campaignId, workspaceId } = job;
    const from = opts.from ?? 30;
    await this.campaigns.updateStatus(campaignId, "running", from);
    const known = opts.savedEarly ? await this.leads.campaignLeadKeys(campaignId) : new Map<string, string>();
    const fresh = raw.filter((l) => !known.has(leadKey(l)));
    const processed = fresh.length ? await this.prepare(job, fresh, { from }) : [];

    if (processed.length) await this.leads.createMany(processed);
    await this.campaigns.refreshStats(campaignId);
    await this.campaigns.updateStatus(campaignId, "completed", 100, opts.note);
    this.geo.start(workspaceId); // province / kota / kecamatan for the new leads, in the background
    this.logger.log(`Campaign ${campaignId}: ${processed.length} leads saved${opts.savedEarly ? ` (${opts.savedEarly} saved earlier)` : ""}`);

    // Contact details from each business's own website. Runs after the campaign is complete and never fails it.
    if (process.env.SCRAPER_MODE !== "fixture") {
      void this.enrichment.enrichCampaign(workspaceId, campaignId)
        .then((r) => this.logger.log(`Campaign ${campaignId} enrichment: ${JSON.stringify(r)}`))
        .catch((e) => this.logger.warn(`Campaign ${campaignId} enrichment failed: ${e}`));
    }
    return { saved: processed.length + (opts.savedEarly ?? 0) };
  }
}
