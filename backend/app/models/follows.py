from pydantic import BaseModel
from datetime import datetime


class FollowResponse(BaseModel):
    follower_id: str
    following_id: str
    status: str = "accepted"
    created_at: datetime | None = None


class FollowerProfile(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    avatar_color: str | None = None
    is_following_back: bool = False
