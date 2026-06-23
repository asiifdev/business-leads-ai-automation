import { test, expect } from "./fixtures";

const CAMPAIGN = {
  name: `E2E Campaign ${Date.now()}`,
  location: "Jakarta",
  query: "Restaurant Jakarta Selatan",
  service: "Sistem manajemen restoran berbasis AI",
};

test.describe("Campaigns", () => {
  test("campaigns list page loads", async ({ authedPage: page }) => {
    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { name: /campaigns/i })).toBeVisible();
  });

  test("create campaign form renders all required fields", async ({ authedPage: page }) => {
    await page.goto("/campaigns/new");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.getByText("Location")).toBeVisible();
    await expect(page.getByText("Industry")).toBeVisible();
    await expect(page.getByText("Search Queries")).toBeVisible();
  });

  test("create campaign → starts scraper → completes with leads", async ({ authedPage: page }) => {
    await page.goto("/campaigns/new");

    // Fill form
    await page.fill("#name", CAMPAIGN.name);
    await page.fill('input[placeholder*="Jakarta"], input[placeholder*="location"], #location', CAMPAIGN.location);

    // Select industry (first available option)
    await page.locator('[id="industry"], button:has-text("Select industry")').first().click();
    await page.locator('[role="option"]').first().click();

    // Search query
    await page.locator('input[placeholder*="query"], input[placeholder*="Search"]').first().fill(CAMPAIGN.query);

    // Your service
    const serviceField = page.locator('textarea, input[placeholder*="service"]').first();
    if (await serviceField.isVisible()) await serviceField.fill(CAMPAIGN.service);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to campaign detail page
    await page.waitForURL(/\/campaigns\/[a-z0-9-]+$/, { timeout: 15000 });
    await expect(page.getByText(CAMPAIGN.name)).toBeVisible();

    // Wait for campaign to complete (scraper uses mock fallback — should finish in < 30s)
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 45000 });
  });

  test("completed campaign shows leads", async ({ authedPage: page }) => {
    await page.goto("/campaigns");

    // Find first completed campaign and click it
    const completedBadge = page.locator("text=Completed").first();
    await expect(completedBadge).toBeVisible({ timeout: 10000 });

    // Click the campaign row/card
    await page.locator("a[href*='/campaigns/']").first().click();
    await page.waitForURL(/\/campaigns\/[a-z0-9-]+$/);

    // Leads section should show at least 1 lead
    await expect(page.locator("text=/Leads \\(\\d+\\)/")).toBeVisible({ timeout: 10000 });
    const leadsText = await page.locator("text=/Leads \\(\\d+\\)/").textContent();
    const count = parseInt(leadsText?.match(/\d+/)?.[0] ?? "0");
    expect(count).toBeGreaterThan(0);
  });
});
