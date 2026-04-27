from fastapi import APIRouter, Depends, Query
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.services.weeks import get_edition_week
from app.services.feed import is_week_unlocked, is_past_week, get_feed_posts

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

    if is_past_week(week, year):
        posts = get_feed_posts(db, user_id, week, year)
        return {"locked": False, "posts": posts, "week": week, "year": year}

    if not is_week_unlocked(db, user_id, week, year):
        following = (
            db.table("follows")
            .select("following_id")
            .eq("follower_id", user_id)
            .execute()
        )
        following_ids = [row["following_id"] for row in following.data or []]

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

    posts = get_feed_posts(db, user_id, week, year)
    return {"locked": False, "posts": posts, "week": week, "year": year}


@router.get("/archive")
async def get_archive(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    """Get all past-week published posts from followed users, grouped by week."""
    current_week, current_year = get_edition_week()

    following = (
        db.table("follows")
        .select("following_id")
        .eq("follower_id", user_id)
        .execute()
    )
    following_ids = [row["following_id"] for row in following.data or []]
    if not following_ids:
        return {"weeks": []}

    posts = (
        db.table("posts")
        .select("*, profiles!posts_user_id_fkey(username, display_name, avatar_url)")
        .eq("is_published", True)
        .in_("user_id", following_ids)
        .order("year", desc=True)
        .order("week_number", desc=True)
        .order("published_at", desc=True)
        .execute()
    )

    weeks: dict[str, dict] = {}
    for post in posts.data or []:
        if post["year"] == current_year and post["week_number"] >= current_week:
            continue
        key = f"{post['year']}-{post['week_number']}"
        if key not in weeks:
            weeks[key] = {
                "week_number": post["week_number"],
                "year": post["year"],
                "posts": [],
            }

        blocks = (
            db.table("blocks")
            .select("*")
            .eq("post_id", post["id"])
            .order("sort_order")
            .execute()
        )
        post["blocks"] = blocks.data or []
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
        .select("*")
        .eq("user_id", user_id)
        .eq("is_published", True)
        .order("year", desc=True)
        .order("week_number", desc=True)
        .execute()
    )

    result = []
    for post in posts.data or []:
        blocks = (
            db.table("blocks")
            .select("*")
            .eq("post_id", post["id"])
            .order("sort_order")
            .execute()
        )
        post["blocks"] = blocks.data or []
        result.append(post)

    return {"posts": result}
