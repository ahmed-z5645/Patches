# Patches

A personal documentation platform with a "Bento" grid aesthetic. You publish one weekly post made of rich artifact tiles (markdown, image, Spotify, Strava, map, code, weather). The core mechanic — **the Toll**: to unlock and read the people you follow for a given week, you must publish your own valid post (title + ≥100 words) for that week.

## How it works

- **The Toll** — publishing a valid post (title + ≥100 words) unlocks the current week's follower feed.
- **Monday Reveal** — each **Monday at 9:00 AM Eastern (America/New_York)** the week's posts become visible to unlocked users. The edition-week boundary is Mon 9 AM ET, so Mon 00:00–08:59 ET still counts as the prior week. Computed at query time — no cron job.
- **Late Flag** — posts published after the Monday 9 AM ET deadline get a permanent "Late" flag but still unlock the feed. Late posts stay accepted until the week fully closes (~one extra edition week of grace).
- **Public profiles** (`/[username]`) — always reachable and bypass the Toll, but the Monday 9 AM ET reveal embargo still applies to non-owners.
- **Archive** — past-week posts are visible to followers without needing a current-week post.

## Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS, Framer Motion, dnd-kit — `frontend/`
- **Backend:** FastAPI (Python) — `backend/`
- **Auth / DB / Storage:** Supabase (PostgreSQL + Auth + Storage) — migrations in `supabase/`
- **Deploy:** Frontend → Vercel, Backend → Railway, Database → Supabase (managed)

> Note: Next.js 16 renames `middleware.ts` → `proxy.ts`. See `CLAUDE.md` for architecture details and conventions.

## Repo layout

```
frontend/   Next.js app (App Router, route groups: (auth), (app), [username], post)
backend/    FastAPI app (app/routers, app/services, app/models)
supabase/   SQL migrations (00001…00011) + config
CLAUDE.md   Architecture & conventions (authoritative)
```

## Local development

```bash
# Frontend
cd frontend && npm install && npm run dev      # → localhost:3000

# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload                  # → localhost:8000
```

## Database setup

Apply the migrations in `supabase/migrations/` **in numeric order** (`00001` → `00011`) to your Supabase project — via the Supabase SQL editor, `supabase db push`, or `psql`.

- **Do not run `supabase/seed.sql` in production** — it inserts demo accounts with a known password.
- Accounts created *before* `00001` (the `handle_new_user()` trigger) won't have a `public.profiles` row; backfill from `auth.users` if needed.

## Environment variables

**Frontend** (Vercel / `frontend/.env`):

| Var | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL. **Must include `https://`** and no trailing slash. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-push application server key (public) |

`NEXT_PUBLIC_*` vars are inlined at **build time** — change them, then redeploy.

**Backend** (Railway / `backend/.env`):

| Var | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | — |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-side only |
| `SUPABASE_JWT_SECRET` | yes | used to verify Supabase JWTs |
| `FRONTEND_URL` | yes (prod) | exact origin for CORS, e.g. `https://patches-nine.vercel.app` (scheme, no trailing slash) |
| `VAPID_PRIVATE_KEY` | optional | PEM block; web push disabled (logged) if absent/non-PEM |
| `VAPID_PUBLIC_KEY` | optional | — |
| `VAPID_CONTACT_EMAIL` | optional | real address; used in the web-push `sub` claim |

The three `SUPABASE_*` vars have no defaults — the backend fails on startup if any is missing.

## Deployment notes

- **Backend (Railway):** start command is in `backend/railpack.json` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`); service root must be `backend/`. A long-running APScheduler job sends weekly push reminders, so the backend needs a persistent process — don't put it on a serverless platform.
- **Frontend (Vercel):** standard Next.js build. The service worker (`public/sw.js`) serves navigations network-only and versions its cache, so deploys propagate without users clearing storage.
