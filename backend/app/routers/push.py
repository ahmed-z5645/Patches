from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client
from app.deps import get_db, get_authenticated_user

router = APIRouter(prefix="/api/push", tags=["push"])


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushKeys


class PushUnsubscribe(BaseModel):
    endpoint: str


@router.post("/subscribe", status_code=204)
async def subscribe(
    body: PushSubscription,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    db.table("push_subscriptions").upsert(
        {
            "user_id": user_id,
            "endpoint": body.endpoint,
            "p256dh": body.keys.p256dh,
            "auth": body.keys.auth,
        },
        on_conflict="user_id,endpoint",
    ).execute()


@router.delete("/subscribe", status_code=204)
async def unsubscribe(
    body: PushUnsubscribe,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    db.table("push_subscriptions").delete().eq("user_id", user_id).eq("endpoint", body.endpoint).execute()
