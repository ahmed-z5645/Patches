from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.models.posts import PostResponse, PostCreate, PostUpdate
from app.services.posts import calculate_word_count
from app.services.feed import is_week_unlocked
from app.services.weeks import get_edition_week, is_late_for_week, can_target_week, is_revealed
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.post("", response_model=PostResponse)
async def create_post(
    body: PostCreate,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    existing = (
        db.table("posts")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_number", body.week_number)
        .eq("year", body.year)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    if not can_target_week(body.week_number, body.year):
        raise HTTPException(
            status_code=400,
            detail="Cannot post for this week — it is outside the allowed window.",
        )

    result = (
        db.table("posts")
        .insert(
            {
                "user_id": user_id,
                "week_number": body.week_number,
                "year": body.year,
            }
        )
        .execute()
    )
    return result.data[0]


@router.get("/me/current-week", response_model=PostResponse)
async def get_current_week_post(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    week, year = get_edition_week()
    existing = (
        db.table("posts")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_number", week)
        .eq("year", year)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    result = (
        db.table("posts")
        .insert({"user_id": user_id, "week_number": week, "year": year})
        .execute()
    )
    return result.data[0]


def _adjacent_week(week: int, year: int, delta_days: int) -> tuple[int, int]:
    monday = datetime.fromisocalendar(year, week, 1)
    target = monday + timedelta(days=delta_days)
    iso = target.isocalendar()
    return iso.week, iso.year


def _has_published(db: Client, user_id: str, week: int, year: int) -> bool:
    result = (
        db.table("posts")
        .select("id")
        .eq("user_id", user_id)
        .eq("week_number", week)
        .eq("year", year)
        .eq("is_published", True)
        .execute()
    )
    return bool(result.data)


def _get_or_create(db: Client, user_id: str, week: int, year: int) -> dict:
    existing = (
        db.table("posts")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_number", week)
        .eq("year", year)
        .execute()
    )
    if existing.data:
        return existing.data[0]
    return (
        db.table("posts")
        .insert({"user_id": user_id, "week_number": week, "year": year})
        .execute()
    ).data[0]


@router.get("/me/editor", response_model=PostResponse)
async def get_editor_post(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    """
    Returns the post the editor should open, creating it if needed.

    - Current week not published → current week's post
    - Current week published     → next week's post (pre-publish)
    """
    week, year = get_edition_week()

    if _has_published(db, user_id, week, year):
        next_week, next_year = _adjacent_week(week, year, 7)
        return _get_or_create(db, user_id, next_week, next_year)

    return _get_or_create(db, user_id, week, year)


@router.get("/{post_id}")
async def get_post(
    post_id: str,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = (
        db.table("posts")
        .select(
            "*, profiles!posts_user_id_fkey(username, display_name, avatar_url, is_public), blocks(*)"
        )
        .eq("id", post_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if result.data["user_id"] != user_id:
        if not result.data["is_published"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        author = result.data.get("profiles") or {}
        if author.get("is_public") is False:
            # Private account: viewer must be an accepted follower.
            follow = (
                db.table("follows")
                .select("status")
                .eq("follower_id", user_id)
                .eq("following_id", result.data["user_id"])
                .eq("status", "accepted")
                .execute()
            )
            if not follow.data:
                raise HTTPException(status_code=403, detail="Not authorized")
        # Either the post is past its Monday-9-AM reveal, or the viewer
        # unlocked the current week by publishing their own. Mirrors /api/feed.
        wk, yr = result.data["week_number"], result.data["year"]
        if not is_revealed(wk, yr) and not is_week_unlocked(db, user_id, wk, yr):
            raise HTTPException(status_code=403, detail="Post not yet released")

    result.data["blocks"] = sorted(
        result.data.get("blocks") or [],
        key=lambda b: b.get("sort_order", 0),
    )
    return result.data


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    body: PostUpdate,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    post = db.table("posts").select("*").eq("id", post_id).single().execute()
    if not post.data or post.data["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Post not found")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        return post.data

    if post.data.get("is_published") and is_late_for_week(post.data["week_number"], post.data["year"]):
        update_data["is_late"] = True

    result = (
        db.table("posts").update(update_data).eq("id", post_id).execute()
    )
    return result.data[0]


@router.post("/{post_id}/publish", response_model=PostResponse)
async def publish_post(
    post_id: str,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    post = db.table("posts").select("*").eq("id", post_id).single().execute()
    if not post.data or post.data["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Post not found")

    if not can_target_week(post.data["week_number"], post.data["year"]):
        raise HTTPException(
            status_code=400,
            detail="This week is closed — it cannot be published.",
        )

    if not (post.data.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="Post must have a title")

    word_count = calculate_word_count(db, post_id)
    if word_count < 100:
        raise HTTPException(
            status_code=400,
            detail=f"Post must have at least 100 words (currently {word_count})",
        )

    is_late = is_late_for_week(post.data["week_number"], post.data["year"])

    result = (
        db.table("posts")
        .update(
            {
                "is_published": True,
                "is_late": is_late,
                "word_count": word_count,
                "published_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", post_id)
        .execute()
    )
    return result.data[0]
