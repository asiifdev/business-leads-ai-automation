/**
 * Takes screenshots of the Prospex UI for docs/screenshots/.
 * Requires: dev server on :3000, API on :3001.
 * Run: pnpm --filter @prospex/api exec tsx scripts/take-screenshots.ts
 */
import { chromium, type Page } from "playwright";
import * as path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve(__dirname, "../../../docs/screenshots");
const DEMO_EMAIL = "demo@prospex.local";
const DEMO_PASS = "DemoPass123!";
const W = 1440;
const H = 900;

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#email", DEMO_EMAIL);
  await page.fill("#password", DEMO_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("✓ Logged in as demo@prospex.local");
}

async function shot(page: Page, name: string, wait = 1200) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  console.log(`  📸 ${name}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  try {
    await login(page);

    // 1. Dashboard
    await page.goto(`${BASE}/dashboard`);
    await shot(page, "dashboard.png", 1500);

    // 2. Leads list
    await page.goto(`${BASE}/leads`);
    await shot(page, "leads.png", 1200);

    // 3. Lead detail — find first HIGH priority lead
    const leadHref = await page.locator("a[href*='/leads/']").first().getAttribute("href");
    if (leadHref) {
      await page.goto(`${BASE}${leadHref}`);
      await shot(page, "lead-detail.png", 1200);
    }

    // 4. Campaigns page
    await page.goto(`${BASE}/campaigns`);
    await shot(page, "campaigns.png", 1000);

    // 5. Campaign form — click New Campaign button
    await page.goto(`${BASE}/campaigns`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const newBtn = page.locator('button:has-text("New Campaign"), a:has-text("New Campaign")').first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(OUT, "campaign-form.png"), fullPage: false });
    console.log("  📸 campaign-form.png");

    // 6. Marketing Brief
    const briefPaths = ["/brief", "/settings/brief", "/marketing"];
    for (const p of briefPaths) {
      await page.goto(`${BASE}${p}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      if (!page.url().includes("login") && !page.url().includes("dashboard")) break;
    }
    await shot(page, "marketing-brief.png", 800);

    // 7. AI Style
    await page.goto(`${BASE}/style`);
    await shot(page, "ai-style.png", 1000);

    // 8. Outbox
    await page.goto(`${BASE}/outbox`);
    await shot(page, "outbox.png", 1200);

    // 9. Knowledge base (new page)
    await page.goto(`${BASE}/knowledge`);
    await shot(page, "knowledge.png", 1500);

    console.log(`\n✅ All screenshots saved to docs/screenshots/`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
