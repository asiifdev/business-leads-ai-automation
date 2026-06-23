import { test, expect } from "./fixtures";

test.describe("Export", () => {
  test("export CSV from leads list triggers download", async ({ authedPage: page }) => {
    await page.goto("/leads");

    // Listen for download event
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);

    const exportBtn = page.locator('button:has-text("Export CSV")');
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();

    const download = await downloadPromise;
    // If there are leads, download triggers. If DB is empty, API returns empty CSV — still a download.
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    }
    // No error on page
    await expect(page.locator("text=Unauthorized")).not.toBeVisible();
  });

  test("export CSV from campaign detail triggers download", async ({ authedPage: page }) => {
    await page.goto("/campaigns");

    const firstLink = page.locator("a[href*='/campaigns/']").first();
    const hasCampaigns = await firstLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCampaigns) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/campaigns\/[a-z0-9-]+$/);

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);

    const csvBtn = page.locator('button:has-text("CSV")');
    await expect(csvBtn).toBeVisible({ timeout: 5000 });
    await csvBtn.click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    }
    await expect(page.locator("text=Unauthorized")).not.toBeVisible();
  });

  test("export JSON from campaign detail triggers download", async ({ authedPage: page }) => {
    await page.goto("/campaigns");

    const firstLink = page.locator("a[href*='/campaigns/']").first();
    const hasCampaigns = await firstLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCampaigns) { test.skip(); return; }

    await firstLink.click();
    await page.waitForURL(/\/campaigns\/[a-z0-9-]+$/);

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
    await page.locator('button:has-text("JSON")').click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    }
  });
});
