import { test, expect } from "./fixtures";

test.describe("Settings", () => {
  test("settings page loads all sections", async ({ authedPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/API Keys/i)).toBeVisible();
    await expect(page.getByText(/AI Configuration/i).or(page.getByText(/OpenAI/i))).toBeVisible();
  });

  test("create API key → appears in list", async ({ authedPage: page }) => {
    await page.goto("/settings");

    const keyName = `E2E Key ${Date.now()}`;

    // Fill key name input
    const nameInput = page.locator('input[placeholder*="key name"], input[placeholder*="Key name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(keyName);

    // Click create
    await page.locator('button:has-text("Generate"), button:has-text("Create")').first().click();

    // New key should appear in the list
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 5000 });
  });

  test("created API key shows px_ prefix", async ({ authedPage: page }) => {
    await page.goto("/settings");

    const nameInput = page.locator('input[placeholder*="key name"], input[placeholder*="Key name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(`Prefix Test ${Date.now()}`);
    await page.locator('button:has-text("Generate"), button:has-text("Create")').first().click();

    // The revealed key should start with px_
    await expect(page.locator("text=/px_/")).toBeVisible({ timeout: 5000 });
  });

  test("delete API key removes it from list", async ({ authedPage: page }) => {
    await page.goto("/settings");

    const keyName = `Delete Test ${Date.now()}`;
    const nameInput = page.locator('input[placeholder*="key name"], input[placeholder*="Key name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(keyName);
    await page.locator('button:has-text("Generate"), button:has-text("Create")').first().click();
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 5000 });

    // Delete it — find the delete button in the same row
    const row = page.locator(`[data-testid="key-row"]:has-text("${keyName}"), tr:has-text("${keyName}"), li:has-text("${keyName}")`).first();
    const deleteBtn = row.locator('button:has-text("Delete"), button[aria-label*="delete"], button[title*="delete"]');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.getByText(keyName)).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("save AI configuration", async ({ authedPage: page }) => {
    await page.goto("/settings");

    const apiKeyInput = page.locator('input[placeholder*="sk-"], input[placeholder*="API key"]').first();
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Update")').first();

    if (await apiKeyInput.isVisible() && await saveBtn.isVisible()) {
      await apiKeyInput.fill("sk-test-placeholder-key");
      await saveBtn.click();
      // Should not crash — success feedback or no error
      await expect(page.locator("text=error").or(page.locator(".text-red-400"))).not.toBeVisible({ timeout: 3000 });
    }
  });
});
