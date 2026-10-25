import { Injectable, Logger } from "@nestjs/common";
import { fetchResource, pageTextFromHtml } from "../marketing/url-fetch";
import { extractContacts } from "../leads/contact-extract";
import { businessNameFromPage } from "../leads/import/website-list";
import { extractBusinessInfo, readPageMeta } from "../leads/page-meta";
import { phonesFromText, platformOf, profileFromMeta } from "../leads/profile-meta";
import { looksParked } from "../leads/validation";
import { normalizePhone } from "../messaging/phone";
import { isMobileDigits } from "../messaging/phone-intl";
import type { RawSourceLead } from "./sources/lead-source";

const CONCURRENCY = 5;
const MAX_PROFILE_BYTES = 1_200_000;

export interface WebsiteListResult {
  leads: RawSourceLead[];
  /** Hosts that could not be opened or showed no usable page. */
  unreachable: string[];
  /** Hosts whose page is a parked or placeholder site. */
  parked: string[];
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 60); } };

/** Turns a list of website addresses into leads: the name and details come from each page, nothing is made up for a page that cannot be read. */
@Injectable()
export class WebsiteListService {
  private readonly log = new Logger(WebsiteListService.name);
  /** Replaced in checks: the real one refuses local addresses on purpose. */
  fetchPage: typeof fetchResource = fetchResource;

  async read(urls: string[], industry = ""): Promise<WebsiteListResult> {
    const out: WebsiteListResult = { leads: [], unreachable: [], parked: [] };
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= urls.length) return;
        const url = urls[i];
        try {
          const lead = await this.readOne(url, industry);
          if (lead === "parked") out.parked.push(hostOf(url));
          else if (lead) out.leads.push(lead);
          else out.unreachable.push(hostOf(url));
        } catch (e) {
          this.log.debug(`${url}: ${(e as Error).message}`);
          out.unreachable.push(hostOf(url));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
    return out;
  }

  private async readOne(url: string, industry: string): Promise<RawSourceLead | "parked" | null> {
    const platform = platformOf(url);
    if (platform) {
      const r = await this.fetchPage(url, { types: /html/i, maxBytes: MAX_PROFILE_BYTES, headOnly: true });
      const p = profileFromMeta(platform, readPageMeta(r.body));
      if (!p) return null;
      const c = extractContacts(p.bio, r.url);
      const phones = [...c.whatsapp, ...phonesFromText(p.bio)];
      return this.lead({ name: p.name, website: r.url, phone: phones[0] ? "+" + phones[0] : "", email: c.emails[0], social: { [platform]: r.url }, industry });
    }
    const r = await this.fetchPage(url, { types: /html/i });
    const page = pageTextFromHtml(r.url, r.body);
    if (looksParked(page.text)) return "parked";
    const meta = readPageMeta(r.body);
    const info = extractBusinessInfo(meta);
    const c = extractContacts(r.body, r.url);
    const mobile = c.whatsapp[0] ?? info.phones.find((n) => isMobileDigits(n));
    return this.lead({
      name: businessNameFromPage({ jsonldName: info.name, siteName: meta.og.site_name, title: meta.title }, r.url),
      website: r.url, phone: mobile ? "+" + mobile : "", email: c.emails[0] ?? info.emails[0], address: info.address, category: info.type, industry,
    });
  }

  private lead(v: { name: string; website: string; phone: string; email?: string; address?: string; category?: string; social?: Record<string, string>; industry: string }): RawSourceLead {
    return {
      name: v.name, address: v.address ?? "", phone: normalizePhone(v.phone) ? v.phone : "", website: v.website, ...(v.email ? { email: v.email } : {}),
      rating: "N/A", reviewCount: null, category: (v.category ?? "").toLowerCase(), hasWebsite: true, referenceUrl: "", lat: null, lng: null,
      businessStatus: null, ...(v.social ? { social: v.social as RawSourceLead["social"] } : {}), industry: v.industry, source: "website_list",
    };
  }
}
