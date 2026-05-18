from fastapi import APIRouter, Depends, Query
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.services.weeks import get_edition_week
from app.services.feed import (
    POST_WITH_BLOCKS_SELECT,
    attach_sorted_blocks,
    get_feed_posts,
    get_following_ids,
    is_past_week,
    is_week_unlocked,
)

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("")
async def get_feed(
    week: int | None = Query(None),
    year: int | None = Query(None),
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    if week is None or year is None:
        week, year = get_edition_week()

    following_ids = get_following_ids(db, user_id)

    if is_past_week(week, year):
        posts = get_feed_posts(db, following_ids, week, year)
        return {"locked": False, "posts": posts, "week": week, "year": year}

    if not is_week_unlocked(db, user_id, week, year):
        post_count = 0
        if following_ids:
            count_result = (
                db.table("posts")
                .select("id", count="exact")
                .eq("week_number", week)
                .eq("year", year)
                .eq("is_published", True)
                .in_("user_id", following_ids)
                .execute()
            )
            post_count = count_result.count or 0

        return {
            "locked": True,
            "post_count": post_count,
            "week": week,
            "year": year,
        }

    posts = get_feed_posts(db, following_ids, week, year)
    return {"locked": False, "posts": posts, "week": week, "year": year}


@router.get("/older")
async def get_older_posts(
    offset: int = Query(0, ge=0),
    limit: int = Query(6, ge=1, le=20),
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    current_week, current_year = get_edition_week()

    following_ids = get_following_ids(db, user_id)
    if not following_ids:
        return {"posts": [], "has_more": False}

    all_posts = (
        db.table("posts")
        .select(POST_WITH_BLOCKS_SELECT)
        .eq("is_published", True)
        .in_("user_id", following_ids)
        .order("published_at", desc=True)
        .execute()
    )

    past_posts = [
        p for p in (all_posts.data or [])
        if p["year"] < current_year
        or (p["year"] == current_year and p["week_number"] < current_week)
    ]

    page = past_posts[offset : offset + limit]
    attach_sorted_blocks(page)
    return {"posts": page, "has_more": offset + limit < len(past_posts)}


@router.get("/archive")
async def get_archive(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    """Get all past-week published posts from followed users, grouped by week."""
    current_week, current_year = get_edition_week()

    following_ids = get_following_ids(db, user_id)
    if not following_ids:
        return {"weeks": []}

    posts = (
        db.table("posts")
        .select(POST_WITH_BLOCKS_SELECT)
        .eq("is_published", True)
        .in_("user_id", following_ids)
        .order("year", desc=True)
        .order("week_number", desc=True)
        .order("published_at", desc=True)
        .execute()
    )

    weeks: dict[str, dict] = {}
    for post in attach_sorted_blocks(posts.data or []):
        if post["year"] == current_year and post["week_number"] >= current_week:
            continue
        key = f"{post['year']}-{post['week_number']}"
        if key not in weeks:
            weeks[key] = {
                "week_number": post["week_number"],
                "year": post["year"],
                "posts": [],
            }
        weeks[key]["posts"].append(post)

    return {"weeks": list(weeks.values())}


@router.get("/my-posts")
async def get_my_posts(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    """Get all of the current user's published posts."""
    posts = (
        db.table("posts")
        .select("*, blocks(*)")
        .eq("user_id", user_id)
        .eq("is_published", True)
        .order("year", desc=True)
        .order("week_number", desc=True)
        .execute()
    )
    return {"posts": attach_sorted_blocks(posts.data or [])}
