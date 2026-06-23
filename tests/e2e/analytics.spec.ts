import { test, expect } from "./fixtures";

test.describe("Analytics", () => {
  test("analytics page loads without error", async ({ authedPage: page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible();
    // Should not show error state
    await expect(page.locator("text=Failed to load")).not.toBeVisible();
    await expect(page.locator("text=Unauthorized")).not.toBeVisible();
  });

  test("overview stats cards render", async ({ authedPage: page }) => {
    await page.goto("/analytics");
    // Stats cards — look for known labels
    const labels = ["Total Leads", "Active Campaigns", "Conversion", "Deals Won"];
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible({ timeout: 8000 });
    }
  });

  test("dashboard overview page loads", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("text=Unauthorized")).not.toBeVisible();
  });

  test("integrations page loads", async ({ authedPage: page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: /integrations/i })).toBeVisible();
    await expect(page.getByText("WhatsApp Business")).toBeVisible();
  });
});
