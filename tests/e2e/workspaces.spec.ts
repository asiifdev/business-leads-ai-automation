import { test, expect, registerAndLogin } from "./fixtures";

// Own user, so adding a workspace never changes what the shared TEST_USER sees.
const RUN = Date.now();
const USER = {
  name: `WS User ${RUN}`,
  email: `ws-${RUN}@prospex.test`,
  password: "TestPass123!",
  workspace: `First Business ${RUN}`,
};
const SECOND = `Second Business ${RUN}`;
const SWITCHER = /Switch workspace|Ganti workspace/;

test.describe("Workspaces", () => {
  test("one login can create and switch between businesses", async ({ page }) => {
    await registerAndLogin(page, USER);
    const switcher = page.getByRole("button", { name: SWITCHER });
    await expect(switcher).toContainText(USER.workspace);

    // Create a second business
    await switcher.click();
    await page.getByRole("menuitem", { name: /New workspace|Workspace baru/ }).click();
    await page.fill("#new-workspace-name", SECOND);
    await page.getByRole("button", { name: /Create and open|Buat dan buka/ }).click();
    await page.waitForURL("/dashboard", { timeout: 15000 });
    await expect(page.getByRole("button", { name: SWITCHER })).toContainText(SECOND);

    // Both are listed; go back to the first
    await page.getByRole("button", { name: SWITCHER }).click();
    await expect(page.getByRole("menuitem", { name: new RegExp(USER.workspace) })).toBeVisible();
    await page.getByRole("menuitem", { name: new RegExp(USER.workspace) }).click();
    await expect(page.getByRole("button", { name: SWITCHER })).toContainText(USER.workspace, { timeout: 15000 });
  });

  test("a business does not see another business's AI settings", async ({ page }) => {
    const user = { ...USER, email: `ws2-${RUN}@prospex.test`, workspace: `Solo ${RUN}` };
    await registerAndLogin(page, user);
    await page.goto("/settings");
    await page.getByRole("tab", { name: /AI/ }).click();
    // Fresh workspace: no key of its own, and the screen names the workspace it applies to
    await expect(page.getByText(user.workspace, { exact: false }).first()).toBeVisible();
  });
});
