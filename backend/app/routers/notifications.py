from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from app.deps import get_db, get_authenticated_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    query = (
        db.table("notifications")
        .select("*, profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url, avatar_color)")
        .eq("user_id", current_user)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if unread_only:
        query = query.eq("is_read", False)

    result = query.execute()

    notifications = []
    for row in result.data or []:
        actor = row.pop("profiles", None)
        row["actor"] = actor
        notifications.append(row)

    return notifications


@router.get("/unread-count")
async def get_unread_count(
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = (
        db.table("notifications")
        .select("id", count="exact")
        .eq("user_id", current_user)
        .eq("is_read", False)
        .execute()
    )
    return {"count": result.count or 0}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    db.table("notifications").update({"is_read": True}).eq(
        "id", notification_id
    ).eq("user_id", current_user).execute()
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    current_user: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    db.table("notifications").update({"is_read": True}).eq(
        "user_id", current_user
    ).eq("is_read", False).execute()
    return {"status": "ok"}
