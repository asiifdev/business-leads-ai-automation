import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { fetchResource, pageTextFromHtml } from "../marketing/url-fetch";
import { normalizePhone } from "../messaging/phone";
import { PageRenderer } from "../marketing/page-renderer";
import { contactPageLinks, extractContacts, phoneFromWaProfile, mergeContacts, type ExtractedContacts } from "./contact-extract";

const MAX_PER_BATCH = 50;
const CONCURRENCY = 3;

function hasAny(c: ExtractedContacts) {
  return c.emails.length + c.whatsapp.length + c.whatsappHandles.length + Object.keys(c.social).length > 0;
}

export interface EnrichmentResult {
  leadId: string;
  status: "enriched" | "no_website" | "unreachable";
  found?: { emails: number; whatsapp: number; social: number };
}

@Injectable()
export class EnrichmentService {
  private readonly log = new Logger(EnrichmentService.name);
  constructor(private prisma: PrismaService, private renderer: PageRenderer) {}

  /** Reads the lead's own website (home page plus up to two contact or about pages) and stores what is printed there. */
  async enrichLead(workspaceId: string, leadId: string): Promise<EnrichmentResult> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) throw new NotFoundException("Lead not found");
    if (!lead.website) return { leadId, status: "no_website" };

    const pages: string[] = [];
    const found: ExtractedContacts[] = [];
    try {
      const home = await fetchResource(lead.website, { types: /html/i });
      pages.push(home.url);
      found.push(extractContacts(home.body, home.url));
      for (const link of contactPageLinks(home.body, home.url)) {
        try {
          const r = await fetchResource(link, { types: /html/i });
          pages.push(r.url);
          found.push(extractContacts(r.body, r.url));
        } catch { /* a missing contact page is normal */ }
      }
      // Sites that build their content in the browser have little in the static HTML: open them in the browser.
      if (!hasAny(mergeContacts(found)) && pageTextFromHtml(home.url, home.body).thin) {
        try {
          const r = await this.renderer.render(home.url);
          found.push(extractContacts(r.html, r.url));
          for (const link of contactPageLinks(r.html, r.url)) {
            try { const p = await this.renderer.render(link); pages.push(p.url); found.push(extractContacts(p.html, p.url)); } catch { /* ignore */ }
          }
        } catch (e) { this.log.debug(`render ${leadId}: ${(e as Error).message}`); }
      }
    } catch (e) {
      this.log.debug(`enrich ${leadId}: ${(e as Error).message}`);
      await this.prisma.lead.update({ where: { id: leadId }, data: { enrichedAt: new Date(), enrichment: { status: "unreachable", pages: [] } } });
      return { leadId, status: "unreachable" };
    }

    const c = mergeContacts(found);
    // A business with a verified WhatsApp username prints wa.me/<username>; that public page shows the real number.
    const resolved: { handle: string; number: string }[] = [];
    for (const handle of c.whatsappHandles.slice(0, 2)) {
      try {
        const r = await fetchResource(`https://wa.me/${encodeURIComponent(handle)}`, { types: /html/i });
        const n = phoneFromWaProfile(r.body);
        if (n) { resolved.push({ handle, number: n }); if (!c.whatsapp.includes(n)) c.whatsapp.push(n); }
      } catch { /* an unknown username simply stays a handle */ }
    }
    // Fill gaps only; a number from Google Maps is never replaced by one from a website.
    const data: Record<string, unknown> = { enrichedAt: new Date(), enrichment: { status: "enriched", ...c, whatsappResolved: resolved, pages } };
    if (!lead.email && c.emails[0]) data.email = c.emails[0];
    if (!lead.phone && c.whatsapp[0]) {
      data.phone = "+" + c.whatsapp[0];
      data.phoneE164 = normalizePhone("+" + c.whatsapp[0]);
    }
    await this.prisma.lead.update({ where: { id: leadId }, data });
    return { leadId, status: "enriched", found: { emails: c.emails.length, whatsapp: c.whatsapp.length + c.whatsappHandles.length, social: Object.keys(c.social).length } };
  }

  /** Enriches leads of a campaign that have a website and were not enriched yet, a few at a time. */
  async enrichCampaign(workspaceId: string, campaignId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId, campaignId, enrichedAt: null, website: { not: null } },
      select: { id: true }, take: MAX_PER_BATCH,
    });
    const results: EnrichmentResult[] = [];
    for (let i = 0; i < leads.length; i += CONCURRENCY) {
      results.push(...(await Promise.all(leads.slice(i, i + CONCURRENCY).map((l) => this.enrichLead(workspaceId, l.id)))));
    }
    const count = (s: EnrichmentResult["status"]) => results.filter((r) => r.status === s).length;
    return { processed: results.length, enriched: count("enriched"), unreachable: count("unreachable"), withEmail: results.filter((r) => r.found?.emails).length, withWhatsapp: results.filter((r) => r.found?.whatsapp).length };
  }
}
