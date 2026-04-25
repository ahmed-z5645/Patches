from fastapi import Depends
from supabase import Client
from app.db import get_supabase_client
from app.auth import get_current_user


def get_db() -> Client:
    return get_supabase_client()


async def get_authenticated_user(user_id: str = Depends(get_current_user)) -> str:
    return user_id
