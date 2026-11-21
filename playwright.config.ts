import { defineConfig, devices } from "@playwright/test";

// Browser tests: they serve the built site (`npm run build` first, with NEXT_PUBLIC_USE_MOCK=true) on port 3100.
// On a developer's Windows machine they use the installed Chrome; on Jenkins, Playwright's own Chromium.
// E2E_STATIC=true: test the plain-files build instead (`npm run build:static` first), served like Cloudflare Pages does.
const PORT = 3100;
const STATIC = process.env.E2E_STATIC === "true";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
  webServer: {
    command: STATIC ? `node scripts/serve-static.mjs ${PORT}` : `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
