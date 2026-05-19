from pydantic import BaseModel
from datetime import datetime


class PostResponse(BaseModel):
    id: str
    user_id: str
    week_number: int
    year: int
    title: str | None = None
    is_published: bool = False
    is_late: bool = False
    word_count: int = 0
    cover_color: str | None = None
    tags: list[str] = []
    published_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PostCreate(BaseModel):
    week_number: int
    year: int


class PostUpdate(BaseModel):
    title: str | None = None
    cover_color: str | None = None
    tags: list[str] | None = None


class WeekOption(BaseModel):
    role: str  # "missed" | "current" | "next"
    week_number: int
    year: int
    is_late: bool
    unlocks_feed: bool
    has_post: bool
    is_published: bool
    post_id: str | None = None