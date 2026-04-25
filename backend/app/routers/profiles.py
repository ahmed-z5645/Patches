from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.models.profiles import ProfileResponse, ProfileUpdate

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

    result = (
        db.table("profiles")
        .update(update_data)
        .eq("id", user_id)
        .single()
        .execute()
    )
    return result.data


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
