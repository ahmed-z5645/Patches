import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Edition's system tests.
 *
 * `npm run test:e2e` boots both servers itself via the webServer blocks
 * below — no separate terminals required. EDITION_TEST_MODE=1 swaps the
 * backend over to the in-memory store and exposes the /__test__ shim;
 * NEXT_PUBLIC_TEST_MODE=1 swaps the frontend's Supabase clients for a
 * cookie-driven stub.
 */
const BACKEND_PORT = 8001;
const FRONTEND_PORT = 3100; // off the standard 3000 to avoid clashes with `npm run dev`

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // many specs share clock + seed state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serialized; backend test mode is process-global
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      // Backend in test mode — mocked Supabase, /__test__ shim mounted.
      command: `cd ../backend && EDITION_TEST_MODE=1 .venv/bin/uvicorn app.main:app --port ${BACKEND_PORT} --log-level warning`,
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Frontend pointed at the test backend, with the cookie auth stub on.
      command: `NEXT_PUBLIC_TEST_MODE=1 NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT} npx next dev --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile-.*\.spec\.ts/,
    },
  ],
});
