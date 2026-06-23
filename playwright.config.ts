import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // tests share state (logged-in user), run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Assumes dev servers are already running. Start them with:
  //   docker compose up -d
  //   pnpm --filter @prospex/api dev
  //   pnpm --filter @prospex/web dev
  webServer: [
    {
      command: "echo 'Expecting API on :3001'",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: true,
      timeout: 5000,
    },
    {
      command: "echo 'Expecting Web on :3000'",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 5000,
    },
  ],
});
