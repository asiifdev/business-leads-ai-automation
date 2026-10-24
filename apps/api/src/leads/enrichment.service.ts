import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Lead } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fetchResource, pageTextFromHtml } from "../marketing/url-fetch";
import { normalizePhone } from "../messaging/phone";
import { PageRenderer } from "../marketing/page-renderer";
import { STALE_DAYS } from "./data-quality";
import { enrichTarget, readDue, type EnrichTarget } from "./enrich-target";
import { checkEmailDomain, looksParked, mergeValidation, qualityColumns, withSource } from "./validation";
import { cleanEmail, contactPageLinks, extractContacts, phoneFromWaProfile, mergeContacts, type ExtractedContacts } from "./contact-extract";
import { extractBusinessInfo, mergeBusinessInfo, readPageMeta, type BusinessInfo } from "./page-meta";
import { phonesFromText, profileFromMeta } from "./profile-meta";

const MAX_PER_BATCH = 50;
const CONCURRENCY = 3;
const MAX_PROFILE_BYTES = 1_200_000;

function hasAny(c: ExtractedContacts) {
  return c.emails.length + c.whatsapp.length + c.whatsappHandles.length + Object.keys(c.social).length > 0;
}

export interface EnrichmentResult {
  leadId: string;
  /** no_website: nothing to read (no website and no Instagram or Facebook page). */
  status: "enriched" | "no_website" | "unreachable";
  found?: { emails: number; whatsapp: number; social: number };
}

const previousSocial = (enrichment: unknown): Record<string, string> => {
  const s = enrichment && typeof enrichment === "object" ? (enrichment as { social?: unknown }).social : undefined;
  return s && typeof s === "object" ? { ...(s as Record<string, string>) } : {};
};

@Injectable()
export class EnrichmentService {
  private readonly log = new Logger(EnrichmentService.name);
  /** Replaced in checks: the real one refuses local addresses on purpose. */
  fetchPage: typeof fetchResource = fetchResource;
  constructor(private prisma: PrismaService, private renderer: PageRenderer) {}

  /**
   * Reads what the lead publishes about itself: its own website (home page plus up to two contact or about pages), or, when it has
   * none, its public Instagram or Facebook page. Stores the contact details and the business details found there. It only fills
   * empty fields (a number from Google Maps is never replaced) and records where each filled field came from.
   */
  async enrichLead(workspaceId: string, leadId: string): Promise<EnrichmentResult> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) throw new NotFoundException("Lead not found");
    const target = enrichTarget(lead);
    if (!target) return { leadId, status: "no_website" };
    return target.kind === "profile" ? this.enrichFromProfile(lead, target) : this.enrichFromWebsite(lead, target);
  }

  private async enrichFromWebsite(lead: Lead, target: Extract<EnrichTarget, { kind: "website" }>): Promise<EnrichmentResult> {
    const leadId = lead.id;
    const pages: string[] = [];
    const found: ExtractedContacts[] = [];
    const details: BusinessInfo[] = [];
    let parked = false;
    const read = (html: string, url: string) => {
      found.push(extractContacts(html, url));
      details.push(extractBusinessInfo(readPageMeta(html)));
    };
    try {
      const home = await this.fetchPage(target.url, { types: /html/i });
      pages.push(home.url);
      parked = looksParked(pageTextFromHtml(home.url, home.body).text);
      read(home.body, home.url);
      for (const link of contactPageLinks(home.body, home.url)) {
        try {
          const r = await this.fetchPage(link, { types: /html/i });
          pages.push(r.url);
          read(r.body, r.url);
        } catch { /* a missing contact page is normal */ }
      }
      // Sites that build their content in the browser have little in the static HTML: open them in the browser.
      if (!hasAny(mergeContacts(found)) && pageTextFromHtml(home.url, home.body).thin) {
        try {
          const r = await this.renderer.render(home.url);
          read(r.html, r.url);
          for (const link of contactPageLinks(r.html, r.url)) {
            try { const p = await this.renderer.render(link); pages.push(p.url); read(p.html, p.url); } catch { /* ignore */ }
          }
        } catch (e) { this.log.debug(`render ${leadId}: ${(e as Error).message}`); }
      }
    } catch (e) {
      this.log.debug(`enrich ${leadId}: ${(e as Error).message}`);
      const now = new Date();
      const validation = mergeValidation(lead.validation, { websiteLive: false, websiteParked: false }, now);
      await this.prisma.lead.update({ where: { id: leadId }, data: { enrichedAt: now, enrichment: { status: "unreachable", social: previousSocial(lead.enrichment), pages: [] }, validation, ...qualityColumns({ ...lead, validation, enrichedAt: now }, now) } });
      return { leadId, status: "unreachable" };
    }

    const c = mergeContacts(found);
    // A business with a verified WhatsApp username prints wa.me/<username>; that public page shows the real number.
    const resolved: { handle: string; number: string }[] = [];
    for (const handle of c.whatsappHandles.slice(0, 2)) {
      try {
        const r = await this.fetchPage(`https://wa.me/${encodeURIComponent(handle)}`, { types: /html/i });
        const n = phoneFromWaProfile(r.body);
        if (n) { resolved.push({ handle, number: n }); if (!c.whatsapp.includes(n)) c.whatsapp.push(n); }
      } catch { /* an unknown username simply stays a handle */ }
    }
    const about = mergeBusinessInfo(details);
    // A number the site states in its structured data counts only when it is a mobile number: a landline is not on WhatsApp.
    const statedMobile = about.phones.find((n) => n.startsWith("628"));
    return this.save(lead, {
      enrichment: { status: "enriched", ...c, social: { ...previousSocial(lead.enrichment), ...c.social }, whatsappResolved: resolved, about, pages },
      source: "website",
      // An address from structured data goes through the same filter as one printed on a page (template placeholders, image names).
      emails: [...c.emails, ...about.emails.flatMap((e) => cleanEmail(e, null) ?? [])],
      numbers: [...c.whatsapp, ...(statedMobile ? [statedMobile] : [])],
      address: about.address,
      checks: { websiteLive: true, websiteParked: parked },
      found: { emails: c.emails.length, whatsapp: c.whatsapp.length + c.whatsappHandles.length, social: Object.keys(c.social).length },
    });
  }

  /** The public preview of an Instagram or Facebook page: its name and bio, and the contact details written in the bio. */
  private async enrichFromProfile(lead: Lead, target: Extract<EnrichTarget, { kind: "profile" }>): Promise<EnrichmentResult> {
    const leadId = lead.id;
    const now = new Date();
    let preview: ReturnType<typeof profileFromMeta> = null;
    let finalUrl = target.url;
    try {
      const r = await this.fetchPage(target.url, { types: /html/i, maxBytes: MAX_PROFILE_BYTES, headOnly: true });
      finalUrl = r.url;
      preview = profileFromMeta(target.platform, readPageMeta(r.body));
    } catch (e) {
      this.log.debug(`profile ${leadId}: ${(e as Error).message}`);
    }
    if (!preview) {
      // Not public, or the platform showed a login page: remember that we asked, so it is not asked again every day.
      await this.prisma.lead.update({ where: { id: leadId }, data: { enrichedAt: now, enrichment: { status: "unreachable", social: { ...previousSocial(lead.enrichment), [target.platform]: target.url }, pages: [] }, ...qualityColumns({ ...lead, enrichedAt: now }, now) } });
      return { leadId, status: "unreachable" };
    }
    const c = extractContacts(preview.bio, finalUrl);
    const numbers = [...c.whatsapp, ...phonesFromText(preview.bio)];
    const about: BusinessInfo = { ...(preview.bio ? { description: preview.bio.slice(0, 300) } : {}), phones: [], emails: [], sameAs: [finalUrl] };
    return this.save(lead, {
      enrichment: { status: "enriched", emails: c.emails, whatsapp: [...new Set(numbers)], whatsappHandles: c.whatsappHandles, social: { ...previousSocial(lead.enrichment), [target.platform]: finalUrl }, whatsappResolved: [], about, profile: { platform: target.platform, name: preview.name, url: finalUrl }, pages: [finalUrl] },
      source: target.platform,
      emails: c.emails,
      numbers,
      address: undefined,
      checks: {},
      found: { emails: c.emails.length, whatsapp: new Set(numbers).size, social: 1 },
    });
  }

  /** Fills the gaps from what was read, runs the free e-mail check, records sources and re-rates the lead. */
  private async save(lead: Lead, r: { enrichment: Record<string, unknown>; source: string; emails: string[]; numbers: string[]; address?: string; checks: Record<string, boolean>; found: NonNullable<EnrichmentResult["found"]> }): Promise<EnrichmentResult> {
    const now = new Date();
    const data: Record<string, unknown> = { enrichedAt: now, enrichment: r.enrichment };
    const filled: string[] = [];
    const email = !lead.email && r.emails[0] ? r.emails[0] : null;
    if (email) { data.email = email; filled.push("email"); }
    const number = !lead.phone && r.numbers[0] ? r.numbers[0] : null;
    if (number) {
      data.phone = "+" + number;
      data.phoneE164 = normalizePhone("+" + number);
      filled.push("phone");
    }
    if (!lead.address && r.address) { data.address = r.address; filled.push("address"); }
    // Free checks: can the e-mail domain receive mail. A lookup that fails stays "unknown".
    const finalEmail = email ?? lead.email;
    const emailMx = finalEmail ? await checkEmailDomain(finalEmail) : null;
    const validation = mergeValidation(lead.validation, { ...r.checks, ...(finalEmail ? { emailMx } : {}) }, now);
    data.validation = validation;
    if (filled.length) data.fieldMeta = withSource(lead.fieldMeta, filled, r.source, now);
    Object.assign(data, qualityColumns({ ...lead, phone: (data.phone as string | undefined) ?? lead.phone, phoneE164: (data.phoneE164 as string | null | undefined) ?? lead.phoneE164, email: finalEmail, validation, enrichedAt: now }, now));
    await this.prisma.lead.update({ where: { id: lead.id }, data });
    return { leadId: lead.id, status: "enriched", found: r.found };
  }

  /** Reads again when there is something to read and it never was or the reading is older than STALE_DAYS. Returns whether it did; never throws. */
  async refreshIfDue(workspaceId: string, leadId: string): Promise<boolean> {
    try {
      const lead = await this.prisma.lead.findFirst({ where: { id: leadId, workspaceId }, select: { website: true, enrichment: true, enrichedAt: true } });
      if (!lead || !readDue(lead)) return false;
      await this.enrichLead(workspaceId, leadId);
      return true;
    } catch (e) {
      this.log.debug(`refresh ${leadId}: ${(e as Error).message}`);
      return false;
    }
  }

  private async run(workspaceId: string, ids: string[]) {
    const results: EnrichmentResult[] = [];
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      results.push(...(await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) => this.enrichLead(workspaceId, id).catch((): EnrichmentResult => ({ leadId: id, status: "unreachable" }))))));
    }
    const count = (s: EnrichmentResult["status"]) => results.filter((r) => r.status === s).length;
    return { processed: results.length, enriched: count("enriched"), unreachable: count("unreachable"), withEmail: results.filter((r) => r.found?.emails).length, withWhatsapp: results.filter((r) => r.found?.whatsapp).length };
  }

  /** Up to `take` leads that have something to read (website or profile) and are due, oldest reading first. */
  private async due(where: { workspaceId: string; campaignId?: string }, take: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);
    const candidates = await this.prisma.lead.findMany({
      where: { ...where, source: { not: "fixture" }, OR: [{ enrichedAt: null }, { enrichedAt: { lt: cutoff } }] },
      select: { id: true, website: true, enrichment: true, enrichedAt: true },
      orderBy: [{ enrichedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      take: 1000,
    });
    return candidates.filter((l) => readDue(l)).slice(0, take).map((l) => l.id);
  }

  /** Enriches leads of a campaign that were not read yet or not for STALE_DAYS, a few at a time. */
  async enrichCampaign(workspaceId: string, campaignId: string) {
    return this.run(workspaceId, await this.due({ workspaceId, campaignId }, MAX_PER_BATCH));
  }

  /** The same for the whole workspace: "refresh old data". Up to 50 per call; call again for more. */
  async enrichStale(workspaceId: string) {
    const ids = await this.due({ workspaceId }, MAX_PER_BATCH);
    return { ...(await this.run(workspaceId, ids)), remaining: Math.max(0, (await this.due({ workspaceId }, 1000)).length) };
  }
}
