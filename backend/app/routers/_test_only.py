"""Test-mode shim endpoints — mounted only when EDITION_TEST_MODE=1.

The Playwright e2e suite drives the live FastAPI app, but needs to control
the clock and seed users/posts/follows for the scenarios under test. These
endpoints expose the in-memory store and the `freeze_now` hook on
`services.weeks`. They are NEVER mounted in production.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import weeks as weeks_service
from app.test_store import STORE

router = APIRouter(prefix="/__test__", tags=["test-only"])


class FreezeTimeBody(BaseModel):
    iso: str


class SeedUserBody(BaseModel):
    username: str
    is_public: bool = True


class SeedPostBody(BaseModel):
    user_id: str
    week_number: int
    year: int
    title: str | None = None
    body: str | None = None
    published: bool = False
    is_late: bool = False


class SeedFollowBody(BaseModel):
    follower_id: str
    following_id: str
    status: str = "accepted"


@router.post("/reset")
async def reset_state() -> dict:
    STORE.reset()
    weeks_service.freeze_now(None)
    return {"ok": True}


@router.post("/freeze-time")
async def freeze_time(body: FreezeTimeBody) -> dict:
    try:
        instant = datetime.fromisoformat(body.iso.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"bad ISO timestamp: {e}")
    weeks_service.freeze_now(instant)
    return {"frozen_to": body.iso}


@router.post("/unfreeze-time")
async def unfreeze_time() -> dict:
    weeks_service.freeze_now(None)
    return {"ok": True}


@router.post("/seed-user")
async def seed_user(body: SeedUserBody) -> dict[str, Any]:
    row = STORE.seed("profiles", [{
        "username": body.username,
        "display_name": body.username,
        "is_public": body.is_public,
    }])[0]
    # The frontend treats `access_token` as the bearer. In test mode the
    # backend's get_current_user override accepts the literal user id as the
    # token, so we just hand the id back as the token.
    return {
        "id": row["id"],
        "username": row["username"],
        "email": f"{body.username}@test.local",
        "access_token": row["id"],
    }


@router.post("/seed-post")
async def seed_post(body: SeedPostBody) -> dict[str, Any]:
    post = STORE.seed("posts", [{
        "user_id": body.user_id,
        "week_number": body.week_number,
        "year": body.year,
        "title": body.title,
        "is_published": body.published,
        "is_late": body.is_late,
        "word_count": len((body.body or "").split()),
        "published_at": weeks_service._now().isoformat() if body.published else None,
    }])[0]
    if body.body:
        STORE.seed("blocks", [{
            "post_id": post["id"],
            "type": "markdown",
            "content": {"markdown": body.body},
            "grid_layout_desktop": {"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 4},
            "grid_layout_mobile": {"colStart": 1, "colSpan": 1, "rowStart": 1, "rowSpan": 4},
            "sort_order": 0,
        }])
    return {"id": post["id"]}


@router.post("/seed-follow")
async def seed_follow(body: SeedFollowBody) -> dict:
    STORE.seed("follows", [{
        "follower_id": body.follower_id,
        "following_id": body.following_id,
        "status": body.status,
    }])
    return {"ok": True}


@router.get("/dump/{table}")
async def dump_table(table: str) -> dict:
    return {"rows": STORE._rows(table)}
