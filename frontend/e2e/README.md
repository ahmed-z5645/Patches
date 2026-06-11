# Edition system tests (Playwright)

End-to-end specs that exercise the full publish → unlock → reveal cycle
against a live Next.js + FastAPI stack.

## Running

```bash
cd frontend
npx playwright install chromium   # one-time, ~90MB
npm run test:e2e
```

That's it. `playwright.config.ts` boots both servers itself:

- **Backend** on `:8001` with `EDITION_TEST_MODE=1` — swaps Supabase for an
  in-memory store (`backend/app/test_store.py`) and mounts the `/__test__`
  control plane (`backend/app/routers/_test_only.py`).
- **Frontend** on `:3100` with `NEXT_PUBLIC_TEST_MODE=1` and
  `NEXT_PUBLIC_API_URL=http://localhost:8001` — the supabase clients in
  `src/lib/supabase/*.ts` swap to a cookie-driven stub
  (`src/lib/supabase/test-mode.ts`) so no real Supabase project is needed.

The Next dev server uses `distDir: ".next-e2e"` in test mode so it can run
alongside `npm run dev` without a lockfile collision.

## How a spec works

```ts
import { test, expect } from "./fixtures";

test.beforeEach(async ({ api }) => {
  await api.freezeTime("2025-03-18T13:00:00-04:00"); // pin edition week
});

test("...", async ({ api, page, loginAs }) => {
  const alice = await api.seedUser("alice");
  const bob = await api.seedUser("bob");
  await api.seedFollow(alice.id, bob.id);
  await loginAs(page, alice);
  await page.goto("/feed");
  // ...
});
```

Available fixtures (`e2e/fixtures.ts`):

- `api.freezeTime(iso)` / `api.unfreezeTime()` — pin `services.weeks._now()`
- `api.reset()` — clear store (called automatically in `beforeEach`)
- `api.seedUser(username)` — returns `{ id, username, email, access_token }`
- `api.seedPost({ user_id, week_number, year, title, body, published })`
- `api.seedFollow(followerId, followingId)`
- `loginAs(page, user)` — sets the `edition_test_user` cookie

## Specs

| File                    | What it covers                                                                 |
|-------------------------|--------------------------------------------------------------------------------|
| `smoke.spec.ts`         | Backend health, unauth redirect, login cookie → /feed renders                  |
| `publish-toll.spec.ts`  | Feed locked before publish, unlocked after; <100-word publish rejected         |

Future specs (one file each, drop into `e2e/`): `monday-reveal`, `late-flag`,
`week-close`, `bento-editor`, `mobile-layout-review`, `public-profile`,
`feed-social`. Each follows the same fixture pattern — pin the clock, seed
state, drive the UI/API, assert.

## Debugging

```bash
npx playwright test --ui                       # interactive runner
npx playwright test --headed                   # see the browser
npx playwright show-report                     # last HTML report
curl http://localhost:8001/__test__/dump/posts # inspect in-memory state
```
