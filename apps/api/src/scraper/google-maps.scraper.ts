import { Injectable, Logger } from "@nestjs/common";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { normalizeRating, pickCategory } from "./maps-parse";
import { DEFAULT_RADIUS_KM, inArea, type LatLng } from "./areas";

export interface ScrapedBusiness {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  reviewCount: number | null;
  /** The category Google Maps shows for this place ("Toko Kamera"), in the language of the Maps interface. */
  category: string;
  hasWebsite: boolean;
  referenceLink: string;
  lat: number | null;
  lng: number | null;
  source: string;
}

// Google Maps place URLs embed coordinates either as a precise place marker
// (!3d<lat>!4d<lng>) or as the viewport anchor (@lat,lng,zoom) — prefer the former.
function extractLatLng(url: string): { lat: number | null; lng: number | null } {
  const precise = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (precise) return { lat: parseFloat(precise[1]), lng: parseFloat(precise[2]) };
  const viewport = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (viewport) return { lat: parseFloat(viewport[1]), lng: parseFloat(viewport[2]) };
  return { lat: null, lng: null };
}

@Injectable()
export class GoogleMapsScraperService {
  private readonly logger = new Logger(GoogleMapsScraperService.name);
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  /** Where an area is, found once through Google Maps itself and remembered. Null when Maps does not say. */
  private readonly centers = new Map<string, LatLng | null>();

  private async locate(context: BrowserContext, area: string): Promise<LatLng | null> {
    const key = area.trim().toLowerCase();
    if (this.centers.has(key)) return this.centers.get(key) ?? null;
    const page = await context.newPage();
    let found: LatLng | null = null;
    try {
      await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(`${area}, Indonesia`)}?hl=id`, { waitUntil: "domcontentloaded", timeout: 45000 });
      for (let i = 0; i < 18 && !found; i++) {
        await page.waitForTimeout(500);
        const c = extractLatLng(page.url());
        if (c.lat != null && c.lng != null) found = { lat: c.lat, lng: c.lng };
      }
    } catch (e) {
      this.logger.warn(`Could not locate "${area}": ${(e as Error).message}`);
    } finally {
      await page.close().catch(() => undefined);
    }
    this.centers.set(key, found);
    if (!found) this.logger.warn(`Maps did not give a position for "${area}": results will not be checked against its location`);
    return found;
  }

  /**
   * One Google Maps search. With `opts.area` the search is anchored on that place's coordinates, so the answer does not
   * depend on where the server (or the person running it) is, and results that turn out to be outside the area are dropped.
   */
  async scrape(searchQuery: string, maxResults = 20, opts: { area?: string; radiusKm?: number } = {}): Promise<ScrapedBusiness[]> {
    const browser = await this.getBrowser();
    // Indonesian locale and timezone, so listings come back in Indonesian whatever the server's own locale is.
    const context = await browser.newContext({
      locale: "id-ID",
      timezoneId: "Asia/Jakarta",
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
      // Strip control chars + limit length before the text goes into a URL or the search box.
      const safeQuery = String(searchQuery)
        .replace(/[\x00-\x1f<>"'`]/g, "")
        .substring(0, 200);
      const center = opts.area ? await this.locate(context, opts.area) : null;

      this.logger.log(`Searching Google Maps: "${safeQuery}"${center ? ` anchored at ${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : ""}`);

      if (center) {
        await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(safeQuery)}/@${center.lat},${center.lng},13z?hl=id`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector('[role="feed"]', { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
      } else {
        await page.goto("https://www.google.com/maps/", { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2000);
        const searchBox = await page.$('#searchboxinput, input[name="q"], [aria-label="Search Google Maps"]');
        if (searchBox) {
          await searchBox.click({ clickCount: 3 });
          await page.keyboard.type(safeQuery, { delay: 40 });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(3000);
        }
      }

      await this.scrollResultsList(page, maxResults);

      let businesses = await this.extractBusinessCards(page);
      if (center && opts.area) {
        const { kept, dropped } = inArea(businesses, opts.area, center, opts.radiusKm ?? DEFAULT_RADIUS_KM);
        if (dropped > 0) this.logger.warn(`"${safeQuery}": dropped ${dropped} of ${businesses.length} results outside ${opts.area}`);
        businesses = kept;
      }
      this.logger.log(`Extracted ${businesses.length} businesses from Google Maps`);

      await context.close();
      return businesses.slice(0, maxResults);
    } catch (err) {
      this.logger.error(`Google Maps scraping error: ${err}`);
      await context.close().catch(() => undefined);
      throw err; // the caller reports it; an empty list would hide a broken scrape as "no results"
    }
  }

  private async scrollResultsList(page: Page, maxResults: number): Promise<void> {
    // The results list is the element with role="feed". Matching several selectors at once picks the first one in the page,
    // which was a wrapper that cannot scroll, so every search stopped after the first six results.
    const feedSelector = '[role="feed"]';
    const fallbackSelector = '.m6QErb.DxyBCb, .m6QErb, [aria-label*="Results"], [aria-label*="Hasil"]';
    const cardCount = () => page.evaluate(() => document.querySelectorAll('[data-result-index], .Nv2PK, [jsaction*="mouseover:pane"]').length).catch(() => 0);
    const reachedEnd = () => page.evaluate(() => /Anda telah mencapai akhir|You've reached the end/i.test(document.body.innerText)).catch(() => false);

    let stale = 0;
    let prev = 0;
    for (let i = 0; i < 40; i++) {
      const feed = (await page.$(feedSelector)) ?? (await page.$(fallbackSelector));
      if (feed) await feed.evaluate((el) => { (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight; });
      else await page.evaluate(() => window.scrollBy(0, 1000));

      await page.waitForTimeout(1600);
      const count = await cardCount();
      if (count >= maxResults) break;
      if (await reachedEnd()) break; // Google has no more for this search
      if (count === prev) {
        stale++;
        if (stale >= 3) break;
      } else {
        stale = 0;
      }
      prev = count;
    }
  }

  private async extractBusinessCards(page: Page): Promise<ScrapedBusiness[]> {
    // $$eval is Playwright's scoped DOM query — the callback is a static inline
    // function serialized and run in the browser context. No user-supplied data
    // flows into the function body, so there is no injection risk here.
    const cards = await page
      .$$eval(".Nv2PK, [data-result-index]", (cards) =>
        cards
          .map((card) => {
            const nameSels = [".qBF1Pd", ".fontHeadlineSmall", '[class*="fontHeadline"]', "h3"];
            let name = "";
            for (const s of nameSels) {
              const el = card.querySelector(s);
              if (el?.textContent?.trim()) {
                name = el.textContent.trim();
                break;
              }
            }
            if (!name) return null;

            // The rating wrapper's aria-label usually reads like "4.5 stars 1,234 Reviews" —
            // parse both the star value and the review count from it when present.
            let rating = "";
            let reviewCount: number | null = null;
            const ratingWrap = card.querySelector('[aria-label*="star" i]');
            const ariaLabel = ratingWrap?.getAttribute("aria-label") ?? "";
            const ratingMatch = ariaLabel.match(/([\d.]+)\s*star/i);
            const reviewMatch = ariaLabel.match(/([\d.,]+)\s*review/i);
            if (ratingMatch) rating = ratingMatch[1];
            if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/[.,]/g, ""), 10);

            if (!rating) {
              const rEl = card.querySelector(".MW4etd");
              if (rEl) rating = rEl.textContent?.trim() ?? "";
            }

            let address = "";
            let phone = "";
            for (const span of card.querySelectorAll("span")) {
              const t = span.textContent?.trim() ?? "";
              if (!t || t.length < 3) continue;
              if (!phone && /^[+\d]/.test(t) && t.replace(/\D/g, "").length >= 7) {
                if (t.includes("+62") || t.includes("08") || /^\d{3}[\s-]\d/.test(t)) {
                  phone = t;
                  continue;
                }
              }
              if (!address && /\bJl\.|\bJalan\b|\bStreet\b|\bSt\.|\bRd\.|\bNo\.\s*\d/i.test(t)) {
                address = t.replace(/^[·•–]\s*/, "").trim();
              }
              if (reviewCount === null) {
                const m = t.match(/^\(([\d.,]+)\)$/);
                if (m) reviewCount = parseInt(m[1].replace(/[.,]/g, ""), 10);
              }
            }

            let website = "";
            let referenceLink = "";
            for (const a of card.querySelectorAll("a[href]")) {
              const href = (a as HTMLAnchorElement).href ?? "";
              if (href.includes("google.com/maps/place") && !referenceLink) referenceLink = href;
              else if (!website && /https?:\/\//.test(href) && !href.includes("google.com"))
                website = href;
            }

            return {
              name,
              address,
              phone: phone.replace(/\D/g, "").replace(/^62/, "0").replace(/^0+/, "0"),
              rating: rating || "N/A",
              reviewCount,
              rows: [...card.querySelectorAll(".W4Efsd")].map((r) => r.textContent?.trim() ?? ""),
              website,
              hasWebsite: !!website,
              referenceLink,
              source: "Google Maps",
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null),
      )
      .catch(() => []);

    return (cards as Array<Omit<ScrapedBusiness, "category" | "lat" | "lng"> & { rows: string[] }>).map(({ rows, ...card }) => ({
      ...card,
      rating: card.rating === "N/A" ? "N/A" : normalizeRating(card.rating) || "N/A",
      category: pickCategory(rows),
      ...extractLatLng(card.referenceLink),
    }));
  }

  async close(): Promise<void> {
    if (this.browser?.isConnected()) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
