from pydantic import BaseModel
from datetime import datetime


class ProfileResponse(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    bio: str | None = None
    is_public: bool = False
    avatar_url: str | None = None
    avatar_color: str | None = "#223843"
    streak_count: int = 0
    created_at: datetime | None = None


class ProfileUpdate(BaseModel):
    username: str | None = None
    display_name: str | None = None
    bio: str | None = None
    is_public: bool | None = None
    avatar_url: str | None = None
    avatar_color: str | None = None
