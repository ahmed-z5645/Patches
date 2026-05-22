# Edition system tests (Playwright)

End-to-end specs that exercise the full publish → unlock → reveal cycle through
a real browser. The suite is **opt-in** — it requires a backend test-mode shim
that is not yet implemented.

## Required backend shim (not yet built)

The fixtures expect these endpoints, mounted only when `EDITION_TEST_MODE=1`:

| Method | Path                       | Body                                     | Purpose                                              |
|--------|----------------------------|------------------------------------------|------------------------------------------------------|
| POST   | `/__test__/reset`          | —                                        | Clear all in-memory state                            |
| POST   | `/__test__/freeze-time`    | `{ "iso": "2025-03-17T13:00:00Z" }`      | Pin `weeks.datetime.now()`                           |
| POST   | `/__test__/unfreeze-time`  | —                                        | Resume real-clock behavior                           |
| POST   | `/__test__/seed-user`      | `{ "username": "alice" }`                | Insert user + return `{id, username, access_token}`  |
| POST   | `/__test__/seed-post`      | `{ user_id, week_number, year, ... }`    | Insert a (possibly-published) post                   |
| POST   | `/__test__/seed-follow`    | `{ follower_id, following_id }`          | Insert an `accepted` follow row                      |

These should reuse `tests/conftest.py::MockSupabaseClient` as the shared store
and gate their registration on `EDITION_TEST_MODE`. A sketch of the wiring:

```python
# backend/app/main.py
if os.getenv("EDITION_TEST_MODE") == "1":
    from app.routers._test_only import router as test_router
    app.include_router(test_router)
```

`weeks.py` also needs a `_get_now()` indirection that consults a process-local
frozen value when set; the existing `_FrozenDatetime` pattern in
`tests/unit/test_weeks.py` is the model.

## Running

```bash
# Terminal 1 — backend in test mode (mock Supabase, /__test__ shim, port 8001)
cd backend
EDITION_TEST_MODE=1 uvicorn app.main:app --port 8001

# Terminal 2 — Next.js pointed at the test backend
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev

# Terminal 3 — Playwright
cd frontend
npx playwright install --with-deps    # one-time
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  NEXT_PUBLIC_API_URL=http://localhost:8001 \
  npm run test:e2e
```

## What's in the suite

Each spec calls `api.freezeTime(...)` first to pin the edition week, then
seeds users/posts/follows through the shim. The clock is unfrozen and state
reset between tests.

- `smoke.spec.ts` — lightest sanity check; landing page + sign-in route reachable
- *(planned)* `auth.spec.ts` — signup, logout, protected-route redirect
- *(planned)* `publish-toll.spec.ts` — locked feed → publish → unlock
- *(planned)* `monday-reveal.spec.ts` — pre/post Mon 09:00 ET transition
- *(planned)* `late-flag.spec.ts` — late publishing persists "Late" badge
- *(planned)* `week-close.spec.ts` — grace window expires
- *(planned)* `bento-editor.spec.ts` — drag + resize + nested image
- *(planned)* `mobile-layout-review.spec.ts` — required review modal
- *(planned)* `public-profile.spec.ts` — anonymous visit + reveal embargo
- *(planned)* `feed-social.spec.ts` — follow/approve/reject/unfollow

The unplanned specs are intentionally listed here, not in the repo, so they
land alongside the backend shim that makes them runnable.
