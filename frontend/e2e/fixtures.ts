import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Shared Playwright fixtures for Edition's e2e suite.
 *
 * The fixtures call into the backend's `/__test__` shim (mounted only when
 * EDITION_TEST_MODE=1) to seed users/posts/follows and to freeze the clock.
 * See e2e/README.md for the wiring contract.
 */

export interface SeededUser {
  id: string;
  username: string;
  email: string;
  /** Bearer token to set on Supabase storage to log this user in. */
  access_token: string;
}

export interface SeedPostOptions {
  user_id: string;
  week_number: number;
  year: number;
  title?: string;
  /** Combined markdown body (one block). */
  body?: string;
  published?: boolean;
  is_late?: boolean;
}

interface TestAPIs {
  /** Freeze backend "now" to an ISO instant. */
  freezeTime(iso: string): Promise<void>;
  /** Release the frozen clock. */
  unfreezeTime(): Promise<void>;
  /** Reset all in-memory state (users, posts, follows). */
  reset(): Promise<void>;
  /** Create a user; returns id + access_token usable for Supabase login. */
  seedUser(username: string): Promise<SeededUser>;
  /** Persist a post for a user. Defaults to current frozen week if omitted. */
  seedPost(opts: SeedPostOptions): Promise<{ id: string }>;
  /** Create an accepted follow edge a → b. */
  seedFollow(followerId: string, followingId: string): Promise<void>;
}

interface Fixtures {
  api: TestAPIs;
  loginAs(page: Page, user: SeededUser): Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function makeAPI(request: APIRequestContext): TestAPIs {
  async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await request.post(`${API_BASE}${path}`, { data: body ?? {} });
    if (!res.ok()) throw new Error(`${path} → ${res.status()} ${await res.text()}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : ({} as T));
  }
  return {
    freezeTime: (iso) => post("/__test__/freeze-time", { iso }),
    unfreezeTime: () => post("/__test__/unfreeze-time"),
    reset: () => post("/__test__/reset"),
    seedUser: (username) => post("/__test__/seed-user", { username }),
    seedPost: (opts) => post("/__test__/seed-post", opts),
    seedFollow: (follower_id, following_id) =>
      post("/__test__/seed-follow", { follower_id, following_id }),
  };
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    const api = makeAPI(request);
    // Each test gets a clean slate.
    await api.reset();
    await use(api);
    await api.unfreezeTime();
  },
  loginAs: async ({}, use) => {
    use(async (page: Page, user: SeededUser) => {
      // Set the Supabase session cookie via the @supabase/ssr storage shape.
      // The exact cookie name matches the proxy.ts client; this is the seam
      // that lets the frontend recognize the seeded test user as logged-in.
      await page.context().addCookies([
        {
          name: "sb-access-token",
          value: user.access_token,
          domain: "localhost",
          path: "/",
          httpOnly: false,
          sameSite: "Lax",
        },
      ]);
    });
  },
});

export { expect };
