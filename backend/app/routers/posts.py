from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.models.posts import PostResponse, PostCreate, PostUpdate
from app.services.posts import calculate_word_count
from app.services.weeks import get_edition_week, is_late_for_week
from datetime import datetime, timezone

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


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = db.table("posts").select("*").eq("id", post_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if result.data["user_id"] != user_id and not result.data["is_published"]:
        raise HTTPException(status_code=403, detail="Not authorized")
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

    if not post.data.get("title"):
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
