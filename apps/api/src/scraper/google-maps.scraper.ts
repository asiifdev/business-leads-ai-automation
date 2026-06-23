import { Injectable, Logger } from "@nestjs/common";
import { chromium, Browser, Page } from "playwright";

export interface ScrapedBusiness {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  hasWebsite: boolean;
  referenceLink: string;
  source: string;
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

  async scrape(searchQuery: string, maxResults = 20): Promise<ScrapedBusiness[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    try {
      await page.goto("https://www.google.com/maps/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      // Strip control chars + limit length before typing into the search box.
      const safeQuery = String(searchQuery)
        .replace(/[\x00-\x1f<>"'`]/g, "")
        .substring(0, 200);

      this.logger.log(`Searching Google Maps: "${safeQuery}"`);

      const searchBox = await page.$(
        '#searchboxinput, input[name="q"], [aria-label="Search Google Maps"]',
      );
      if (searchBox) {
        await searchBox.click({ clickCount: 3 });
        await page.keyboard.type(safeQuery, { delay: 40 });
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3000);
      }

      await this.scrollResultsList(page, maxResults);

      const businesses = await this.extractBusinessCards(page);
      this.logger.log(`Extracted ${businesses.length} businesses from Google Maps`);

      await page.close();
      return businesses.slice(0, maxResults);
    } catch (err) {
      this.logger.error(`Google Maps scraping error: ${err}`);
      await page.close();
      return [];
    }
  }

  private async scrollResultsList(page: Page, maxResults: number): Promise<void> {
    const containerSelector =
      '[role="feed"], .m6QErb.DxyBCb, .m6QErb, [aria-label*="Results"], [data-value="Results for"]';

    let stale = 0;
    let prev = 0;

    for (let i = 0; i < 60; i++) {
      const container = await page.$(containerSelector);
      if (container) {
        await container.evaluate((el) => {
          (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
        });
      } else {
        await page.evaluate(() => window.scrollBy(0, 1000));
      }

      await page.waitForTimeout(1800);

      const count = await page
        .evaluate(
          () => document.querySelectorAll('[data-result-index], .Nv2PK, [jsaction*="mouseover:pane"]').length,
        )
        .catch(() => 0);

      if (count >= maxResults) break;
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
    return page
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

            let rating = "";
            const rEl = card.querySelector('.MW4etd, [aria-label*="star"]');
            if (rEl) rating = rEl.textContent?.trim() ?? "";

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
              website,
              hasWebsite: !!website,
              referenceLink,
              source: "Google Maps",
            };
          })
          .filter(Boolean),
      )
      .catch(() => []) as Promise<ScrapedBusiness[]>;
  }

  async close(): Promise<void> {
    if (this.browser?.isConnected()) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
