from supabase import Client
from app.services.weeks import get_edition_week


def is_week_unlocked(db: Client, user_id: str, week: int, year: int) -> bool:
    """Check if user has published a valid post for this week."""
    result = (
        db.table("posts")
        .select("id")
        .eq("user_id", user_id)
        .eq("week_number", week)
        .eq("year", year)
        .eq("is_published", True)
        .execute()
    )
    return len(result.data or []) > 0


def is_past_week(week: int, year: int) -> bool:
    """Check if the given week is in the past."""
    current_week, current_year = get_edition_week()
    if year < current_year:
        return True
    if year == current_year and week < current_week:
        return True
    return False


def get_feed_posts(db: Client, user_id: str, week: int, year: int) -> list[dict]:
    """Get published posts from users that user_id follows for a given week."""
    following = (
        db.table("follows")
        .select("following_id")
        .eq("follower_id", user_id)
        .execute()
    )
    following_ids = [row["following_id"] for row in following.data or []]
    if not following_ids:
        return []

    posts = (
        db.table("posts")
        .select("*, profiles!posts_user_id_fkey(username, display_name, avatar_url)")
        .eq("week_number", week)
        .eq("year", year)
        .eq("is_published", True)
        .in_("user_id", following_ids)
        .order("published_at", desc=True)
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

    return result
