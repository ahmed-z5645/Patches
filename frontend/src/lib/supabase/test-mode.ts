/**
 * Test-mode shortcuts — active only when NEXT_PUBLIC_TEST_MODE=1.
 *
 * Replaces the @supabase/ssr clients with a stub that reads an
 * `edition_test_user` cookie. The cookie value is the bearer token
 * (and user id) issued by the backend's /__test__/seed-user endpoint.
 *
 * Lets the Playwright e2e suite drive the live app without a real
 * Supabase project. Everything in this file is gated behind isTestMode().
 */

export const TEST_USER_COOKIE = "edition_test_user";

export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_TEST_MODE === "1";
}

function readCookieFromDocument(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

export interface TestSession {
  access_token: string;
  user: { id: string; email: string };
}

function sessionFromToken(token: string): TestSession {
  return {
    access_token: token,
    user: { id: token, email: `${token}@test.local` },
  };
}

/**
 * A no-op PostgREST-like chainable query that resolves to empty data.
 * Used for direct supabase.from() calls scattered in the frontend (e.g., the
 * (app)/layout.tsx avatar_color lookup). Real data flows through the FastAPI
 * api client; this stub just keeps those direct calls from throwing.
 */
function emptyQuery() {
  const result = Promise.resolve({ data: null, error: null });
  const chain: Record<string, any> = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    single: () => result,
    maybeSingle: () => result,
    then: (onFulfilled: (v: any) => any, onRejected?: (e: any) => any) =>
      result.then(onFulfilled, onRejected),
  };
  return chain;
}

/** Browser-side stub. Mimics enough of the supabase-js client surface. */
export function createTestBrowserClient() {
  return {
    from: () => emptyQuery(),
    auth: {
      async getSession() {
        const token = readCookieFromDocument(TEST_USER_COOKIE);
        return { data: { session: token ? sessionFromToken(token) : null }, error: null };
      },
      async getUser() {
        const token = readCookieFromDocument(TEST_USER_COOKIE);
        return {
          data: { user: token ? sessionFromToken(token).user : null },
          error: null,
        };
      },
      async signOut() {
        if (typeof document !== "undefined") {
          document.cookie = `${TEST_USER_COOKIE}=; Path=/; Max-Age=0`;
        }
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
}

interface CookieAccessor {
  get(name: string): { value: string } | undefined;
}

/** Server-side stub. Reads the cookie from a Next.js cookie accessor. */
export function createTestServerClient(cookies: CookieAccessor) {
  const tokenCookie = cookies.get(TEST_USER_COOKIE);
  const token = tokenCookie?.value;
  return {
    from: () => emptyQuery(),
    auth: {
      async getSession() {
        return { data: { session: token ? sessionFromToken(token) : null }, error: null };
      },
      async getUser() {
        return {
          data: { user: token ? sessionFromToken(token).user : null },
          error: null,
        };
      },
    },
  };
}
