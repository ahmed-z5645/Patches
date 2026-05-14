from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from supabase import Client
from app.config import get_settings
from app.deps import get_db, get_authenticated_user
from app.models.profiles import ProfileResponse, ProfileUpdate
from app.auth import get_current_user
from app.services.weeks import is_revealed


async def _try_extract_user(request: Request) -> str | None:
    """Best-effort caller-id extraction for optional-auth endpoints.

    Returns the user_id if a valid Bearer token is on the request, else None.
    Never raises — endpoints that call this treat the unauthenticated case
    explicitly via the returned value.
    """
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        return await get_current_user(creds, settings=get_settings())
    except Exception:
        return None

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = db.table("profiles").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.get("/me/stats")
async def get_my_stats(
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    """Combined own-profile payload: follower/following counts + published posts
    with blocks. Replaces the 3 separate calls the profile page used to make."""
    followers_count = (
        db.table("follows")
        .select("follower_id", count="exact")
        .eq("following_id", user_id)
        .eq("status", "accepted")
        .execute()
    ).count or 0

    following_count = (
        db.table("follows")
        .select("following_id", count="exact")
        .eq("follower_id", user_id)
        .eq("status", "accepted")
        .execute()
    ).count or 0

    posts = (
        db.table("posts")
        .select("*, blocks(*)")
        .eq("user_id", user_id)
        .eq("is_published", True)
        .order("year", desc=True)
        .order("week_number", desc=True)
        .execute()
    )
    from app.services.feed import attach_sorted_blocks
    return {
        "followers": followers_count,
        "following": following_count,
        "posts": attach_sorted_blocks(posts.data or []),
    }


@router.put("/me", response_model=ProfileResponse)
async def update_my_profile(
    update: ProfileUpdate,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    update_data = update.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "username" in update_data:
        existing = (
            db.table("profiles")
            .select("id")
            .eq("username", update_data["username"])
            .neq("id", user_id)
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="Username already taken")

    going_public = False
    if "is_public" in update_data and update_data["is_public"]:
        current = db.table("profiles").select("is_public").eq("id", user_id).single().execute()
        if current.data and not current.data.get("is_public"):
            going_public = True

    result = (
        db.table("profiles")
        .update(update_data)
        .eq("id", user_id)
        .execute()
    )

    if going_public:
        pending = (
            db.table("follows")
            .select("follower_id")
            .eq("following_id", user_id)
            .eq("status", "pending")
            .execute()
        )
        if pending.data:
            db.table("follows").update({"status": "accepted"}).eq(
                "following_id", user_id
            ).eq("status", "pending").execute()
            notifications = [
                {"user_id": row["follower_id"], "actor_id": user_id, "type": "follow_accepted"}
                for row in pending.data
            ]
            db.table("notifications").insert(notifications).execute()

    return result.data[0]


@router.get("/{username}", response_model=ProfileResponse)
async def get_public_profile(
    username: str,
    db: Client = Depends(get_db),
):
    result = (
        db.table("profiles")
        .select("*")
        .eq("username", username)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.get("/{user_id}/posts")
async def get_public_user_posts(
    user_id: str,
    request: Request,
    db: Client = Depends(get_db),
):
    caller_id = await _try_extract_user(request)

    is_owner = caller_id == user_id
    if not is_owner:
        profile = db.table("profiles").select("is_public").eq("id", user_id).single().execute()
        if not profile.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        if not profile.data.get("is_public"):
            # Private profile — only accepted followers may view posts.
            if not caller_id:
                raise HTTPException(status_code=403, detail="Profile is private")
            follow = (
                db.table("follows")
                .select("status")
                .eq("follower_id", caller_id)
                .eq("following_id", user_id)
                .eq("status", "accepted")
                .execute()
            )
            if not follow.data:
                raise HTTPException(status_code=403, detail="Profile is private")

    posts = (
        db.table("posts")
        .select("*, blocks(*)")
        .eq("user_id", user_id)
        .eq("is_published", True)
        .order("year", desc=True)
        .order("week_number", desc=True)
        .execute()
    )

    # Mirror /api/feed + /api/posts/{id}: a non-owner viewer can see a post
    # whose week hasn't revealed yet IF they've unlocked that week themselves.
    from app.services.feed import attach_sorted_blocks, is_week_unlocked

    unlocked_weeks: dict[tuple[int, int], bool] = {}

    def _viewer_can_see(p: dict) -> bool:
        if is_owner:
            return True
        if is_revealed(p["week_number"], p["year"]):
            return True
        if not caller_id:
            return False
        key = (p["week_number"], p["year"])
        if key not in unlocked_weeks:
            unlocked_weeks[key] = is_week_unlocked(db, caller_id, *key)
        return unlocked_weeks[key]

    visible = [p for p in (posts.data or []) if _viewer_can_see(p)]
    return {"posts": attach_sorted_blocks(visible)}
