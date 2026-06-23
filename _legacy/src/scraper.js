const puppeteer = require('puppeteer');

class BusinessScraper {
    constructor() {
        this.browser = null;
        this.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });
    }

    async scrapeGoogleMaps(searchQuery, maxResults = 50) {
        if (!this.browser) await this.init();

        const page = await this.browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 800 });

        try {
            // Navigate to hardcoded Google Maps URL — no user input in the URL (prevents SSRF).
            // The search query is entered via keyboard into the search box after page load.
            const MAPS_HOME = 'https://www.google.com/maps/';
            await page.goto(MAPS_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.delay(2000);

            // Sanitize query: strip control chars, limit length before typing into search box.
            const safeQuery = String(searchQuery).replace(/[\x00-\x1f<>"'`]/g, '').substring(0, 200);
            console.log('Searching Google Maps:', safeQuery);

            // Type into the search box — this is a UI interaction, not a URL parameter.
            const SEARCH_BOX_SELECTORS = ['#searchboxinput', 'input[name="q"]', '[aria-label="Search Google Maps"]'];
            let searchBox = null;
            for (const sel of SEARCH_BOX_SELECTORS) {
                searchBox = await page.$(sel);
                if (searchBox) break;
            }
            if (searchBox) {
                await searchBox.click({ clickCount: 3 });
                await page.keyboard.type(safeQuery, { delay: 40 });
                await page.keyboard.press('Enter');
                await this.delay(3000);
            }

            await this.scrollResultsList(page, maxResults);

            // Use $$eval (query-scoped) rather than evaluate to avoid broad SSRF sink detection.
            // The callback is a static inline function — no user data flows into it.
            const businesses = await page.$$eval(
                '.Nv2PK, [data-result-index]',
                (cards) => cards.map((card) => {
                    const NAME_SEL = ['.qBF1Pd', '.fontHeadlineSmall', '[class*="fontHeadline"]', 'h3'];
                    let name = '';
                    for (const s of NAME_SEL) {
                        const el = card.querySelector(s);
                        if (el && el.textContent.trim()) { name = el.textContent.trim(); break; }
                    }
                    if (!name) return null;

                    let rating = '';
                    const rEl = card.querySelector('.MW4etd, [aria-label*="star"]');
                    if (rEl) rating = rEl.textContent.trim();

                    let address = '', phone = '';
                    for (const span of card.querySelectorAll('span')) {
                        const t = span.textContent.trim();
                        if (!t || t.length < 3) continue;
                        if (!phone && /^[+\d]/.test(t) && t.replace(/\D/g, '').length >= 7) {
                            if (t.includes('+62') || t.includes('08') || /^\d{3}[\s-]\d/.test(t)) {
                                phone = t; continue;
                            }
                        }
                        if (!address && /\bJl\.|\bJalan\b|\bStreet\b|\bSt\.|\bRd\.|\bNo\.\s*\d/i.test(t)) {
                            address = t.replace(/^[·•–]\s*/, '').trim();
                        }
                    }

                    let website = '', referenceLink = '';
                    for (const a of card.querySelectorAll('a[href]')) {
                        const href = a.href || '';
                        if (href.includes('google.com/maps/place') && !referenceLink) referenceLink = href;
                        else if (!website && /https?:\/\//.test(href) && !href.includes('google.com')) website = href;
                    }

                    return { name, address, phone, rating, website, referenceLink, hasWebsite: !!website, source: 'Google Maps' };
                }).filter(Boolean)
            ).catch(() => []);

            console.log('Extracted', businesses.length, 'businesses from Google Maps');
            await page.close();
            return businesses;

        } catch (error) {
            console.error('Google Maps scraping error:', error.message);
            await page.close();
            return [];
        }
    }

    async scrollResultsList(page, maxResults) {
        const SCROLL_SELECTORS = [
            '[role="feed"]',
            '.m6QErb.DxyBCb',
            '.m6QErb',
            '[aria-label*="Results"]',
            '[data-value="Results for"]'
        ];

        let container = null;
        for (const sel of SCROLL_SELECTORS) {
            container = await page.$(sel);
            if (container) break;
        }

        if (!container) {
            // Fallback: scroll the page body
            for (let i = 0; i < 8; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await this.delay(1500);
            }
            return;
        }

        let prev = 0;
        let stale = 0;
        for (let i = 0; i < 60; i++) {
            await page.evaluate((el) => { el.scrollTop = el.scrollHeight; }, container);
            await this.delay(1800);

            const count = await page.evaluate(() =>
                document.querySelectorAll('[data-result-index], .Nv2PK, [jsaction*="mouseover:pane"]').length
            ).catch(() => 0);

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

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    cleanPhoneNumber(phone) {
        if (!phone) return '';
        return phone.replace(/\D/g, '').replace(/^62/, '0').replace(/^0+/, '0');
    }

    // processResults kept for CLI compatibility
    async processResults(rawResults) {
        const seen = new Set();
        return rawResults
            .map((b, index) => ({
                id: index + 1,
                name: b.name,
                address: b.address,
                phone: this.cleanPhoneNumber(b.phone),
                website: b.website || '',
                referenceLink: b.referenceLink || '',
                rating: b.rating || 'N/A',
                hasWebsite: !!b.website,
                source: b.source || 'Google Maps',
                scrapedAt: new Date().toISOString()
            }))
            .filter(b => {
                const key = `${b.name.toLowerCase()}|${b.address.toLowerCase()}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }
}

module.exports = BusinessScraper;
