from supabase import Client
from app.services.weeks import get_edition_week, is_revealed


# Columns selected when listing posts for clients. Embedding blocks here
# replaces a per-post blocks fetch (the N+1 pattern) with a single round trip.
POST_WITH_BLOCKS_SELECT = (
    "*, profiles!posts_user_id_fkey(username, display_name, avatar_url), blocks(*)"
)


def attach_sorted_blocks(posts: list[dict]) -> list[dict]:
    """Sort each post's embedded `blocks` list by sort_order ascending.

    PostgREST does not reliably honor .order() on embedded resources, so we
    sort in Python after the join.
    """
    for post in posts:
        post["blocks"] = sorted(
            post.get("blocks") or [],
            key=lambda b: b.get("sort_order", 0),
        )
    return posts


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
    """Returns True if the week is in the past AND its Monday 9 AM reveal has passed."""
    current_week, current_year = get_edition_week()
    is_prior_week = year < current_year or (year == current_year and week < current_week)
    return is_prior_week and is_revealed(week, year)


def get_following_ids(db: Client, user_id: str) -> list[str]:
    """Return the list of user_ids that this user follows with status=accepted."""
    following = (
        db.table("follows")
        .select("following_id")
        .eq("follower_id", user_id)
        .eq("status", "accepted")
        .execute()
    )
    return [row["following_id"] for row in following.data or []]


def get_feed_posts(db: Client, following_ids: list[str], week: int, year: int) -> list[dict]:
    """Get published posts from a given set of followed user_ids for a week.

    Caller supplies following_ids so we do not re-query the follows table
    when the caller has already computed it (e.g. for a locked-feed count).
    """
    if not following_ids:
        return []

    posts = (
        db.table("posts")
        .select(POST_WITH_BLOCKS_SELECT)
        .eq("week_number", week)
        .eq("year", year)
        .eq("is_published", True)
        .in_("user_id", following_ids)
        .order("published_at", desc=True)
        .execute()
    )
    return attach_sorted_blocks(posts.data or [])
