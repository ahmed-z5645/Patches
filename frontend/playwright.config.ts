import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Edition's system tests.
 *
 * Requires the backend to be running in TEST MODE so that:
 *   - Supabase is mocked (in-memory state, no external dep)
 *   - The /__test__ endpoints exist for clock freeze + seeding
 *
 * Run locally:
 *   1. cd backend && EDITION_TEST_MODE=1 uvicorn app.main:app --port 8001
 *   2. cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8001 npm run test:e2e
 *
 * (The backend test-mode shim is not yet implemented — see e2e/README.md.)
 */
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
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
