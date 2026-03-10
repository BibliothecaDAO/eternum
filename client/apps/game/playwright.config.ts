import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://127.0.0.1:4173";
const baseUrl = new URL(baseURL);
const webServerHost = baseUrl.hostname;
const webServerPort = baseUrl.port || (baseUrl.protocol === "https:" ? "443" : "80");
const shouldManageWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: shouldManageWebServer
    ? {
        command: `PATH="/Users/os/Library/pnpm:$PATH" pnpm dev --host ${webServerHost} --port ${webServerPort} --strictPort`,
        ignoreHTTPSErrors: true,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
