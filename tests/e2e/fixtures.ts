import { test as base, expect, type Page } from "@playwright/test";

// Unique per test run — avoids conflicts if DB is shared between runs
const RUN_ID = Date.now();

export const TEST_USER = {
  name: `E2E User ${RUN_ID}`,
  email: `e2e-${RUN_ID}@prospex.test`,
  password: "TestPass123!",
  workspace: `E2E Workspace ${RUN_ID}`,
};

// TEST_USER is a module-level singleton (shared across every spec file in the
// run), so only the first authedPage use should register — subsequent uses
// must log in, or registration fails on the duplicate email and the test
// hangs waiting for a redirect that never happens.
let hasRegistered = false;

/** Register once, log in on every subsequent use; reuse page state in each test */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    if (!hasRegistered) {
      await registerAndLogin(page, TEST_USER);
      hasRegistered = true;
    } else {
      await loginOnly(page, TEST_USER);
    }
    await use(page);
  },
});

export { expect };

export async function registerAndLogin(
  page: Page,
  user: typeof TEST_USER,
): Promise<void> {
  await page.goto("/register");
  await page.fill("#name", user.name);
  await page.fill("#workspace", user.workspace);
  await page.fill("#reg-email", user.email);
  await page.fill("#reg-password", user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard", { timeout: 15000 });
}

export async function loginOnly(page: Page, user: typeof TEST_USER): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard", { timeout: 15000 });
}
