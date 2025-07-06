const puppeteer = require("puppeteer");

class BusinessScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true, // Set true untuk production
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Browser initialized");
  }

  async scrapeGoogleMaps(searchQuery, maxResults = 50) {
    if (!this.browser) await this.init();

    const page = await this.browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(
        searchQuery
      )}`;
      console.log(`Searching: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await this.delay(3000);

      // Scroll untuk load lebih banyak results
      await this.scrollResults(page, maxResults);

      // Debug: Get page structure info
      const debugInfo = await page.evaluate(() => {
        const info = {
          jsactionElements: document.querySelectorAll('[jsaction]').length,
          roleElements: document.querySelectorAll('[role]').length,
          dataValueElements: document.querySelectorAll('[data-value]').length,
          clickableElements: document.querySelectorAll('[jsaction*="pane"], [jsaction*="place"], [jsaction*="rating"]').length,
          allDivs: document.querySelectorAll('div').length,
          allSpans: document.querySelectorAll('span').length,
          allAs: document.querySelectorAll('a').length,
          bodyTextLength: document.body.textContent.length,
          title: document.title,
          wrapper: document.querySelectorAll('.TFQHme ').length
        };
        
        // Get first 500 chars of body text for analysis
        info.bodyTextPreview = document.body.textContent.substring(0, 500);
        
        return info;
      });
      
      console.log('=== DEBUG: Page Structure Analysis ===');
      console.log(`Title: ${debugInfo.title}`);
      console.log(`Elements with jsaction: ${debugInfo.jsactionElements}`);
      console.log(`Elements with role: ${debugInfo.roleElements}`);
      console.log(`Elements with data-value: ${debugInfo.dataValueElements}`);
      console.log(`Clickable business elements: ${debugInfo.clickableElements}`);
      console.log(`Total divs: ${debugInfo.allDivs}`);
      console.log(`Total spans: ${debugInfo.allSpans}`);
      console.log(`Total links: ${debugInfo.allAs}`);
      console.log(`Body text length: ${debugInfo.bodyTextLength}`);
      console.log('Body text preview:');
      console.log(debugInfo.bodyTextPreview);
      console.log({wrapper: debugInfo.wrapper})
      
      // Extract business data directly from the list without clicking
      const businesses = await page.evaluate(() => {
        const results = [];
        
        // Method 1: Look for business cards using TFQHme separators
        const separators = document.querySelectorAll('.TFQHme');
        console.log(`Found ${separators.length} TFQHme separators`);
        
        for (let i = 0; i < separators.length; i++) {
          const separator = separators[i];
          const nextDiv = separator.nextElementSibling;
          
          if (nextDiv) {
            const businessCard = nextDiv.querySelector('.Nv2PK');
            if (businessCard) {
              // Extract business name
              const nameElement = businessCard.querySelector('.qBF1Pd.fontHeadlineSmall');
              const name = nameElement ? nameElement.textContent.trim() : '';
              
              // Extract address - look for span with address pattern
              let address = '';
              const allSpans = businessCard.querySelectorAll('span');
              for (const span of allSpans) {
                const text = span.textContent.trim();
                if (text.includes('Jl.') || text.includes('Street') || text.includes('Road') || text.includes('No.')) {
                  // Remove "· " prefix if present
                  address = text.replace(/^[·•]\s*/, '');
                  break;
                }
              }
              
              // Extract phone - look for span with phone pattern
              let phone = '';
              for (const span of allSpans) {
                const text = span.textContent.trim();
                if (text.match(/\d{3,}/) && (text.includes('+62') || text.includes('08') || text.includes('-'))) {
                  phone = text;
                  break;
                }
              }
              
              // Extract rating
              let rating = '';
              const ratingElement = businessCard.querySelector('.MW4etd');
              if (ratingElement) {
                rating = ratingElement.textContent.trim();
              }
              
              // Extract website - look for website link specifically
              let website = '';
              let referenceLink = '';
              const websiteLinks = businessCard.querySelectorAll('a');
              for (const link of websiteLinks) {
                const href = link.href;
                const text = link.textContent.trim();
                
                // Look for Google Maps reference link
                if (href && href.includes('google.com/maps')) {
                  referenceLink = href;
                }
                
                // Look for website links that are not Google Maps links
                if (href && 
                    !href.includes('google.com/maps') && 
                    !href.includes('maps.google.com') &&
                    (href.includes('.com') || href.includes('.co.id') || href.includes('.id')) &&
                    (text.includes('Situs Web') || text.includes('Website') || text.includes('www'))) {
                  website = href;
                }
              }
              
              if (name && address) {
                results.push({
                  name,
                  address,
                  phone,
                  rating,
                  website,
                  referenceLink,
                  hasWebsite: !!website
                });
                console.log(`Extracted: ${name} - ${address} - ${phone}`);
              }
            }
          }
        }
        
        // Method 2: If no results from separators, try direct business card selection
        if (results.length === 0) {
          const businessCards = document.querySelectorAll('.Nv2PK');
          console.log(`Found ${businessCards.length} business cards directly`);
          
          for (let i = 0; i < businessCards.length; i++) {
            const card = businessCards[i];
            
            // Extract business name
            const nameElement = card.querySelector('.qBF1Pd.fontHeadlineSmall');
            const name = nameElement ? nameElement.textContent.trim() : '';
            
            // Extract address
            let address = '';
            const allSpans = card.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent.trim();
              if (text.includes('Jl.') || text.includes('Street') || text.includes('Road') || text.includes('No.')) {
                // Remove "· " prefix if present
                address = text.replace(/^[·•]\s*/, '');
                break;
              }
            }
            
            // Extract phone
            let phone = '';
            for (const span of allSpans) {
              const text = span.textContent.trim();
              if (text.match(/\d{3,}/) && (text.includes('+62') || text.includes('08') || text.includes('-'))) {
                phone = text;
                break;
              }
            }
            
            // Extract rating
            let rating = '';
            const ratingElement = card.querySelector('.MW4etd');
            if (ratingElement) {
              rating = ratingElement.textContent.trim();
            }
            
            // Extract website - look for website link specifically
            let website = '';
            let referenceLink = '';
            const websiteLinks = card.querySelectorAll('a');
            for (const link of websiteLinks) {
              const href = link.href;
              const text = link.textContent.trim();
              
              // Look for Google Maps reference link
              if (href && href.includes('google.com/maps')) {
                referenceLink = href;
              }
              
              // Look for website links that are not Google Maps links
              if (href && 
                  !href.includes('google.com/maps') && 
                  !href.includes('maps.google.com') &&
                  (href.includes('.com') || href.includes('.co.id') || href.includes('.id')) &&
                  (text.includes('Situs Web') || text.includes('Website') || text.includes('www'))) {
                website = href;
              }
            }
            
            if (name && address) {
              results.push({
                name,
                address,
                phone,
                rating,
                website,
                referenceLink,
                hasWebsite: !!website
              });
              console.log(`Extracted: ${name} - ${address} - ${phone}`);
            }
          }
        }
        
        console.log(`Total extracted: ${results.length} businesses`);
        return results;
      });
      
      console.log(`Successfully extracted ${businesses.length} businesses`);
      
      this.results = [...this.results, ...businesses];
      return businesses;

      await page.close();
      return businesses;
    } catch (error) {
      console.error("Error scraping Google Maps:", error);
      await page.close();
      return [];
    }
  }

  async scrollResults(page, maxResults = 20) {
    console.log(`Scrolling to load more results (target: ${maxResults})...`);

    try {
      // Try multiple scroll containers
      const scrollSelectors = [
        '[role="feed"]',
        '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd',
        '[role="main"]',
        '.section-layout',
        '.section-scrollbox',
        '.scrollable-y',
        '[data-role="region"]'
      ];
      
      let scrollContainer = null;
      for (const selector of scrollSelectors) {
        scrollContainer = await page.$(selector);
        if (scrollContainer) {
          console.log(`Found scroll container: ${selector}`);
          break;
        }
      }
      
      if (!scrollContainer) {
        console.log("No scroll container found, trying alternative method");
        // Try scrolling the page itself
        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => {
            window.scrollBy(0, 1000);
          });
          await this.delay(2000);
          console.log(`Page scroll ${i + 1}/10`);
        }
        return;
      }

      // Scroll until we reach maxResults or can't load more
      let previousCount = 0;
      let noChangeCount = 0;
      const maxScrollAttempts = 50; // Prevent infinite scrolling
      
      for (let i = 0; i < maxScrollAttempts; i++) {
        await page.evaluate((container) => {
          container.scrollTop = container.scrollHeight;
        }, scrollContainer);

        await this.delay(2000);
        
        // Check current results count
        const resultCount = await page.evaluate(() => {
          return document.querySelectorAll('.TFQHme').length;
        });
        
        console.log(`Scroll ${i + 1}/${maxScrollAttempts} - Current results: ${resultCount}`);
        
        // If we've reached target, stop
        if (resultCount >= maxResults) {
          console.log(`Reached target of ${maxResults} results (actual: ${resultCount}), stopping scroll`);
          break;
        }
        
        // If no new results after 3 attempts, stop
        if (resultCount === previousCount) {
          noChangeCount++;
          if (noChangeCount >= 3) {
            console.log(`No new results after ${noChangeCount} attempts, stopping scroll`);
            break;
          }
        } else {
          noChangeCount = 0;
        }
        
        previousCount = resultCount;
      }
    } catch (error) {
      console.log("Scroll completed with minor issues:", error.message);
    }
  }

  async scrapeYellowPages(searchQuery, location = "Jakarta") {
    if (!this.browser) await this.init();

    const page = await this.browser.newPage();

    try {
      // Contoh untuk direktori bisnis Indonesia
      const searchUrl = `https://www.yellowpages.co.id/search?q=${encodeURIComponent(
        searchQuery
      )}&location=${encodeURIComponent(location)}`;
      console.log(`Searching Yellow Pages: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2" });
      await this.delay(2000);

      const businesses = await page.evaluate(() => {
        const results = [];
        const businessElements = document.querySelectorAll(
          ".listing-item, .business-item"
        );

        businessElements.forEach((element) => {
          const nameElement = element.querySelector(
            "h3, .business-name, .listing-name"
          );
          const addressElement = element.querySelector(
            ".address, .business-address"
          );
          const phoneElement = element.querySelector(".phone, .business-phone");

          const business = {
            name: nameElement?.textContent?.trim() || "",
            address: addressElement?.textContent?.trim() || "",
            phone: phoneElement?.textContent?.trim() || "",
            source: "YellowPages",
          };

          if (business.name && business.address) {
            results.push(business);
          }
        });

        return results;
      });

      console.log(`Found ${businesses.length} businesses from Yellow Pages`);
      this.results = [...this.results, ...businesses];

      await page.close();
      return businesses;
    } catch (error) {
      console.error("Error scraping Yellow Pages:", error);
      await page.close();
      return [];
    }
  }

  cleanPhoneNumber(phone) {
    if (!phone) return "";

    // Remove common prefixes and format
    return phone
      .replace(/\D/g, "") // Remove non-digits
      .replace(/^62/, "0") // Convert +62 to 0
      .replace(/^0+/, "0"); // Remove multiple leading zeros
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Email generation skipped for now
  async findEmails(businessName, location) {
    return []; // Skip email generation for now
  }

  async processResults() {
    console.log("Processing and cleaning results...");

    const processedResults = await Promise.all(
      this.results.map(async (business, index) => {
        const cleanPhone = this.cleanPhoneNumber(business.phone);
        const possibleEmails = await this.findEmails(
          business.name,
          business.address
        );

        return {
          id: index + 1,
          name: business.name,
          address: business.address,
          phone: cleanPhone,
          website: business.website || "",
          referenceLink: business.referenceLink || "",
          possibleEmails: possibleEmails,
          rating: business.rating || "N/A",
          source: business.source || "Google Maps",
          scrapedAt: new Date().toISOString(),
        };
      })
    );

    // Remove duplicates based on name and address
    const uniqueResults = processedResults.filter(
      (business, index, self) =>
        index ===
        self.findIndex(
          (b) =>
            b.name.toLowerCase() === business.name.toLowerCase() &&
            b.address.toLowerCase() === business.address.toLowerCase()
        )
    );

    console.log(`Processed ${uniqueResults.length} unique businesses`);
    return uniqueResults;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

module.exports = BusinessScraper; 