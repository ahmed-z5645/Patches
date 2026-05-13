from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.models.profiles import ProfileResponse, ProfileUpdate
from app.auth import get_current_user as extract_user
from app.services.weeks import is_revealed

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
    caller_id = None
    try:
        caller_id = await extract_user(request)
    except Exception:
        pass

    is_owner = caller_id == user_id
    if not is_owner:
        profile = db.table("profiles").select("is_public").eq("id", user_id).single().execute()
        if not profile.data or not profile.data.get("is_public"):
            raise HTTPException(status_code=403, detail="Profile is private")

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
        if not is_owner and not is_revealed(post["week_number"], post["year"]):
            continue
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
