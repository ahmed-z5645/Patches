from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.models.follows import FollowerProfile

router = APIRouter(prefix="/api/follows", tags=["follows"])


@router.post("/{user_id}")
async def follow_user(
    user_id: str,
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    if current_user == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = (
        db.table("follows")
        .select("*")
        .eq("follower_id", current_user)
        .eq("following_id", user_id)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        if row["status"] == "accepted":
            return {"status": "already_following"}
        if row["status"] == "pending":
            return {"status": "already_requested"}
        if row["status"] == "rejected":
            db.table("follows").update({"status": "pending"}).eq(
                "follower_id", current_user
            ).eq("following_id", user_id).execute()
            db.table("notifications").insert(
                {
                    "user_id": user_id,
                    "actor_id": current_user,
                    "type": "follow_request",
                }
            ).execute()
            return {"status": "requested"}

    profile = (
        db.table("profiles")
        .select("is_public")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="User not found")

    is_public = profile.data.get("is_public", True)

    if is_public:
        db.table("follows").insert(
            {"follower_id": current_user, "following_id": user_id, "status": "accepted"}
        ).execute()
        db.table("notifications").insert(
            {"user_id": user_id, "actor_id": current_user, "type": "new_follower"}
        ).execute()
        return {"status": "followed"}
    else:
        db.table("follows").insert(
            {"follower_id": current_user, "following_id": user_id, "status": "pending"}
        ).execute()
        db.table("notifications").insert(
            {"user_id": user_id, "actor_id": current_user, "type": "follow_request"}
        ).execute()
        return {"status": "requested"}


@router.delete("/{user_id}")
async def unfollow_user(
    user_id: str,
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    db.table("follows").delete().eq("follower_id", current_user).eq(
        "following_id", user_id
    ).execute()
    db.table("notifications").delete().eq("actor_id", current_user).eq(
        "user_id", user_id
    ).eq("type", "follow_request").execute()
    return {"status": "unfollowed"}


@router.get("/requests", response_model=list[FollowerProfile])
async def get_follow_requests(
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = (
        db.table("follows")
        .select("follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, avatar_color)")
        .eq("following_id", current_user)
        .eq("status", "pending")
        .execute()
    )
    return [row["profiles"] for row in result.data or []]


@router.post("/requests/{follower_id}/accept")
async def accept_follow_request(
    follower_id: str,
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    existing = (
        db.table("follows")
        .select("*")
        .eq("follower_id", follower_id)
        .eq("following_id", current_user)
        .eq("status", "pending")
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="No pending request found")

    db.table("follows").update({"status": "accepted"}).eq(
        "follower_id", follower_id
    ).eq("following_id", current_user).execute()

    db.table("notifications").delete().eq("actor_id", follower_id).eq(
        "user_id", current_user
    ).eq("type", "follow_request").execute()

    db.table("notifications").insert(
        {"user_id": follower_id, "actor_id": current_user, "type": "follow_accepted"}
    ).execute()

    return {"status": "accepted"}


@router.post("/requests/{follower_id}/reject")
async def reject_follow_request(
    follower_id: str,
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    existing = (
        db.table("follows")
        .select("*")
        .eq("follower_id", follower_id)
        .eq("following_id", current_user)
        .eq("status", "pending")
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="No pending request found")

    db.table("follows").delete().eq("follower_id", follower_id).eq(
        "following_id", current_user
    ).execute()

    db.table("notifications").delete().eq("actor_id", follower_id).eq(
        "user_id", current_user
    ).eq("type", "follow_request").execute()

    return {"status": "rejected"}


@router.get("/followers", response_model=list[FollowerProfile])
async def get_followers(
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = (
        db.table("follows")
        .select("follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, avatar_color)")
        .eq("following_id", current_user)
        .eq("status", "accepted")
        .execute()
    )
    follower_ids = [row["follower_id"] for row in result.data or []]
    following_back = set()
    if follower_ids:
        fb = (
            db.table("follows")
            .select("following_id")
            .eq("follower_id", current_user)
            .eq("status", "accepted")
            .in_("following_id", follower_ids)
            .execute()
        )
        following_back = {row["following_id"] for row in fb.data or []}
    return [
        {**row["profiles"], "is_following_back": row["follower_id"] in following_back}
        for row in result.data or []
    ]


@router.get("/following", response_model=list[FollowerProfile])
async def get_following(
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = (
        db.table("follows")
        .select("following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url, avatar_color)")
        .eq("follower_id", current_user)
        .eq("status", "accepted")
        .execute()
    )
    return [row["profiles"] for row in result.data or []]


@router.get("/check/{user_id}")
async def check_following(
    user_id: str,
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = (
        db.table("follows")
        .select("status")
        .eq("follower_id", current_user)
        .eq("following_id", user_id)
        .execute()
    )
    if not result.data:
        return {"is_following": False, "status": None}
    status = result.data[0]["status"]
    return {"is_following": status == "accepted", "status": status}
