from pydantic import BaseModel
from typing import Any


class BlockResponse(BaseModel):
    id: str
    post_id: str
    parent_block_id: str | None = None
    type: str
    content: dict[str, Any] = {}
    grid_layout_desktop: dict[str, Any] = {}
    grid_layout_mobile: dict[str, Any] = {}
    float_position: str | None = None
    z_index: int = 0
    sort_order: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class BlockCreate(BaseModel):
    type: str
    content: dict[str, Any] = {}
    grid_layout_desktop: dict[str, Any] = {}
    grid_layout_mobile: dict[str, Any] = {}
    parent_block_id: str | None = None
    float_position: str | None = None


class BlockUpdate(BaseModel):
    content: dict[str, Any] | None = None
    z_index: int | None = None


class BlockLayoutUpdate(BaseModel):
    grid_layout_desktop: dict[str, Any] | None = None
    grid_layout_mobile: dict[str, Any] | None = None
