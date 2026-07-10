---
name: verify
description: Boot Edition's test-mode servers and drive the frontend with Playwright to verify a change end-to-end (no real Supabase needed).
---

# Verifying Edition changes end-to-end

The e2e harness (frontend/e2e/, playwright.config.ts) runs both servers in
test mode: in-memory backend store + `/__test__` seeding shim, and a frontend
Supabase stub driven by the `edition_test_user` cookie.

## Boot (backgrounded, from repo root)

```bash
cd backend && EDITION_TEST_MODE=1 FRONTEND_URL=http://localhost:3100 \
  .venv/bin/uvicorn app.main:app --port 8001 --log-level warning
cd frontend && NEXT_PUBLIC_TEST_MODE=1 NEXT_PUBLIC_API_URL=http://localhost:8001 \
  npx next dev --port 3100
```

Health checks: `GET :8001/api/health`, `GET :3100/`.

**Gotcha — CORS:** backend `allow_origins` only includes `:3000` and
`settings.frontend_url`. Browser-driven API calls from `:3100` fail preflight
unless you pass `FRONTEND_URL=http://localhost:3100` to the backend (the
playwright.config.ts webServer block does NOT do this).

## Seed + login (see frontend/e2e/fixtures.ts for the full contract)

- `POST :8001/__test__/reset`, `/freeze-time {iso}`, `/seed-user {username}`
  (returns `access_token`), `/seed-post`, `/seed-follow`.
- Blocks with arbitrary types/layouts: `POST /api/posts/{id}/blocks` with a
  Bearer token. Use data-URI SVGs for image blocks (offline-safe).
- Login = set cookie `edition_test_user=<access_token>` for domain
  `localhost` before navigating.

## Driving with a Playwright script

- Script must live inside `frontend/` (or anywhere under it) so Node resolves
  `@playwright/test` — the scratchpad dir is outside the package.
- Editor route: `/editor/{postId}`. The header **Publish** button is disabled
  until title + ≥100 markdown words; clicking it opens the prepublish screen.
- The phone preview grid is `div[style*='grid-template-columns: repeat(2, 174px)']`;
  tiles are its direct children.
- Interacting with tiles inside the phone's internal scroll: scroll them into
  view first and take fresh bounding boxes. `force: true` clicks on
  out-of-view elements silently no-op, and mouse drags started outside the
  visible tiles turn into text selection.
- Drag = mouse.down, then ≥10 small mouse.move steps (dnd-kit needs the 6px
  activation distance and incremental dragOver events), then mouse.up.
