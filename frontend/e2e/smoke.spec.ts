import { test, expect } from "./fixtures";

/**
 * Smoke check — verifies the dev servers are up, the landing page renders,
 * and the unauthenticated /feed redirects to /login. Does NOT depend on the
 * backend /__test__ shim (so it runs even before the shim lands), apart from
 * the per-test `api.reset()` call which will simply 404 — wrapped to tolerate
 * that during bootstrap.
 *
 * Once the test-mode shim exists, replace the try/catch with the real call.
 */
test.beforeEach(async ({ api }) => {
  try {
    await api.reset();
  } catch {
    // shim not mounted yet; smoke still useful as a server-up probe.
  }
});

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  // The landing route exists in app/(public)/page.tsx; pin some visible text.
  // If the heading copy changes, update this matcher.
  await expect(page).toHaveTitle(/Edition/i);
});

test("unauthenticated /feed redirects to /login", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/login(\?|$)/);
});
