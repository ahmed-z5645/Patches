# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Edition is a personal documentation platform with "Bento" grid aesthetics. Users publish weekly posts containing rich artifact tiles. The core mechanic: you must publish a valid post (title + 100 words minimum) each week to unlock your followers' posts for that week. Posts are revealed every Sunday at midnight.

## Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS, Framer Motion — in `frontend/`
- **Backend:** FastAPI (Python) — in `backend/`
- **Auth/DB/Storage:** Supabase (PostgreSQL + Auth + Storage) — migrations in `supabase/`
- **Drag & Drop:** dnd-kit for bento grid tile manipulation

## Build & Dev Commands

```bash
# Frontend
cd frontend && npm run dev          # Next.js dev server → localhost:3000
cd frontend && npm run build        # Production build
cd frontend && npm run lint         # ESLint

# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload       # FastAPI dev server → localhost:8000
```

## Architecture

### Frontend → Backend Communication

The frontend uses Supabase Auth for authentication (session cookies managed via `@supabase/ssr` in `proxy.ts`). All business logic goes through FastAPI endpoints. The frontend API client (`src/lib/api.ts`) extracts the Supabase JWT from the session and passes it as a Bearer token to FastAPI. FastAPI verifies the JWT using `python-jose` in `backend/app/auth.py`.

**Note:** Next.js 16 renamed `middleware.ts` to `proxy.ts` and the export from `middleware` to `proxy`.

### Routing (Next.js App Router)

- `(auth)/` route group — login, signup, callback (public, redirects to /feed if authed)
- `(app)/` route group — feed, editor, archive, settings (protected, redirects to /login if not authed)
- `[username]/` — Public legacy page (always reachable, bypasses the Toll; Sunday reveal still applies to non-owners)
- Layout: vertical Sidebar on desktop (80px left rail), BottomTabBar on mobile

### FastAPI Backend

- `app/routers/` — API endpoints (profiles, posts, blocks, feed, follows, upload)
- `app/services/` — Business logic (week calculation, publish validation, feed computation)
- `app/models/` — Pydantic request/response schemas
- `app/auth.py` — Supabase JWT verification
- `app/deps.py` — FastAPI dependency injection (db client, current user)

### The Bento Grid System

- **Desktop:** 4-column grid. Tile widths are integer columns (1–4). Tile heights use 0.5 increments — CSS Grid rows must be exactly half the column width (`grid-auto-rows: calc(<col-width> / 2)`). DB stores integer rowSpan; visual height = rowSpan / 2.
- **Mobile:** Explicit 1 or 2-column stack defined by the user during a mandatory Mobile Layout Review before publishing. Ordered by `grid_layout_mobile.order`.
- **Markdown nesting exception:** Image/embed tiles can be dropped inside Markdown tiles and use CSS floats for magazine-style text wrapping.

### Content Model

Everything in a post is a **Block**. Types: `markdown`, `image`, `spotify`, `strava`, `map`, `code`, `weather`. Blocks can nest inside Markdown blocks via `parent_block_id` with a `float_position`.

### WYSIWYG Promise

The editor and viewer are the same interface — zero abstraction between drafting and reading.

### Social Mechanics

- **The Toll:** Publishing a valid post (title + ≥100 words) unlocks the current week's follower feed.
- **Sunday Reveal:** Each Sunday at midnight, the week's posts become visible to unlocked users. Computed at query time, no cron job.
- **Late Flag:** Posts after Sunday midnight get a permanent "Late" flag but still unlock the feed.
- **Archive:** Past-week posts are visible to followers without needing a current-week post.

### Database Schema (Supabase/PostgreSQL)

Key tables: `profiles`, `follows`, `posts`, `blocks`. Posts are keyed by `unique(user_id, week_number, year)`. Blocks store separate `grid_layout_desktop` and `grid_layout_mobile` as JSONB. RLS policies enforce access control. The `handle_new_user()` trigger auto-creates a profile row on signup.

## Design Tokens (from Figma)

- Background: white, Tile/divider fill: `#d9d9d9`, Text: black
- Font: Inter (headings + body), Roboto (countdown pill)
- Border radius: 15px on all tiles and pills
- Desktop sidebar: 80px wide, Mobile bottom bar: 80px tall

## Key Constraints

- Post validation: title required, word_count ≥ 100 across all markdown blocks
- Grid row spans map to fractional heights: stored rowSpan / 2 = visual tile height
- Mobile layout is user-defined, not auto-derived from desktop layout
- Public profile pages (`/[username]`) bypass the Toll (no publish-to-unlock required to view them), but the Sunday reveal embargo still applies to non-owners — anonymous and logged-in non-owner visitors only see weeks that have already revealed; the owner sees their own current-week post early
