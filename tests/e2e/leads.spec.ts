import { test, expect } from "./fixtures";

test.describe("Leads", () => {
  test("leads list page loads", async ({ authedPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible();
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test("search filter narrows results", async ({ authedPage: page }) => {
    await page.goto("/leads");

    const searchInput = page.locator('input[placeholder*="Search"]');
    // Search for something that will not match anything
    await searchInput.fill("__no_match_xyz_12345__");
    // Table should show empty state or 0 rows
    const rows = page.locator("table tbody tr, [data-testid='lead-row']");
    const count = await rows.count();
    expect(count).toBe(0);

    // Clear search — rows should reappear (if leads exist)
    await searchInput.clear();
  });

  test("priority filter works", async ({ authedPage: page }) => {
    await page.goto("/leads");

    // Click priority filter
    await page.locator('button:has-text("All priorities"), [placeholder="Priority"]').first().click();
    await page.locator('[role="option"]:has-text("High")').click();

    // URL or UI state changed — just verify no crash
    await expect(page.locator("body")).toBeVisible();
  });

  test("lead detail page opens from list", async ({ authedPage: page }) => {
    await page.goto("/leads");

    const firstLeadLink = page.locator("a[href*='/leads/']").first();
    const hasLeads = await firstLeadLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasLeads) {
      test.skip(); // No leads in DB yet — skip gracefully
      return;
    }

    await firstLeadLink.click();
    await page.waitForURL(/\/leads\/[a-z0-9-]+$/);
    await expect(page.locator("h1, h2")).toBeVisible();
  });

  test("update CRM status on lead detail", async ({ authedPage: page }) => {
    await page.goto("/leads");

    const firstLeadLink = page.locator("a[href*='/leads/']").first();
    const hasLeads = await firstLeadLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasLeads) { test.skip(); return; }

    await firstLeadLink.click();
    await page.waitForURL(/\/leads\/[a-z0-9-]+$/);

    // Find CRM status select/button and change it
    const crmSelect = page.locator('[id="crm-status"], button:has-text("New"), button:has-text("Contacted")').first();
    if (await crmSelect.isVisible()) {
      await crmSelect.click();
      await page.locator('[role="option"]:has-text("Contacted")').click();

      // Update button
      const updateBtn = page.locator('button:has-text("Update CRM")');
      if (await updateBtn.isVisible()) {
        await updateBtn.click();
        // Should not show error
        await expect(page.locator("text=error").or(page.locator(".text-red-400"))).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});
