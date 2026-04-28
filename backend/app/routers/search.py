from fastapi import APIRouter, Depends, Query
from supabase import Client
from app.deps import get_db, get_authenticated_user

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/users")
async def search_users(
    q: str = Query(..., min_length=1),
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = db.rpc(
        "search_users",
        {"query_text": q, "caller_id": user_id},
    ).execute()
    return result.data or []


@router.get("/posts")
async def search_posts(
    q: str = Query(..., min_length=1),
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    result = db.rpc(
        "search_posts",
        {"query_text": q, "caller_id": user_id},
    ).execute()
    return result.data or []
