import { test, expect, TEST_USER, loginOnly } from "./fixtures";

test.describe("Auth", () => {
  // Uses the authedPage fixture → register + login happens automatically
  test("register creates account and redirects to dashboard", async ({ authedPage: page }) => {
    await expect(page).toHaveURL("/dashboard");
    // Sidebar should show workspace name
    await expect(page.getByText(TEST_USER.workspace)).toBeVisible();
  });

  test("login with correct credentials redirects to dashboard", async ({ authedPage: page }) => {
    // Log out first
    await page.locator('[title="Sign out"]').click();
    await page.waitForURL("/login");

    // Log back in
    await loginOnly(page, TEST_USER);
    await expect(page).toHaveURL("/dashboard");
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", TEST_USER.email);
    await page.fill("#password", "WrongPassword999!");
    await page.click('button[type="submit"]');

    // Error message should appear, URL should stay on /login
    await expect(page.locator("text=Invalid credentials").or(page.locator('[class*="text-red"]'))).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL("/login");
  });

  test("accessing /dashboard without token redirects to /login", async ({ page }) => {
    // Clear any stored token
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("prospex_token"));

    await page.goto("/dashboard");
    await page.waitForURL("/login", { timeout: 5000 });
    await expect(page).toHaveURL("/login");
  });

  test("logout clears session and redirects to /login", async ({ authedPage: page }) => {
    await page.locator('[title="Sign out"]').click();
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");

    // Token should be gone — /dashboard should redirect again
    await page.goto("/dashboard");
    await page.waitForURL("/login", { timeout: 5000 });
  });
});

// Standalone tests — use the extended `test` but with plain `page` (no authedPage)
test.describe("Public routes", () => {
  test("/login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("/register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#reg-email")).toBeVisible();
    await expect(page.locator("#reg-password")).toBeVisible();
  });
});
