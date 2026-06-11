import { test, expect } from "./fixtures";

/** Sanity check: backend test-mode shim is reachable and the frontend boots. */

test("backend health responds with test_mode=true", async ({ request }) => {
  const res = await request.get("http://localhost:8001/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.test_mode).toBe(true);
});

test("unauthenticated /feed redirects to /login", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test("seed-user + login cookie lets /feed render", async ({ api, page, loginAs }) => {
  const alice = await api.seedUser("alice");
  await loginAs(page, alice);
  await page.goto("/feed");
  // We're past the login redirect — URL stays on /feed.
  await expect(page).toHaveURL(/\/feed/);
});
