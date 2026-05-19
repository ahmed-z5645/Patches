from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.models.blocks import BlockResponse, BlockCreate, BlockUpdate, BlockLayoutUpdate
from app.routers.upload import delete_image_by_url

router = APIRouter(tags=["blocks"])


def verify_post_ownership(db: Client, post_id: str, user_id: str):
    post = db.table("posts").select("user_id").eq("id", post_id).single().execute()
    if not post.data or post.data["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Post not found")


def verify_block_ownership(db: Client, block_id: str, user_id: str) -> dict:
    block = db.table("blocks").select("*, posts(user_id)").eq("id", block_id).single().execute()
    if not block.data:
        raise HTTPException(status_code=404, detail="Block not found")
    post_data = block.data.get("posts", {})
    if post_data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return block.data


@router.post("/api/posts/{post_id}/blocks", response_model=BlockResponse)
async def create_block(
    post_id: str,
    body: BlockCreate,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    verify_post_ownership(db, post_id, user_id)

    result = (
        db.table("blocks")
        .insert(
            {
                "post_id": post_id,
                "type": body.type,
                "content": body.content,
                "grid_layout_desktop": body.grid_layout_desktop,
                "grid_layout_mobile": body.grid_layout_mobile,
                "parent_block_id": body.parent_block_id,
                "float_position": body.float_position,
                "style": body.style if body.style is not None else {},
            }
        )
        .execute()
    )
    return result.data[0]


@router.get("/api/posts/{post_id}/blocks", response_model=list[BlockResponse])
async def get_blocks(
    post_id: str,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    verify_post_ownership(db, post_id, user_id)

    result = (
        db.table("blocks")
        .select("*")
        .eq("post_id", post_id)
        .order("sort_order")
        .execute()
    )
    return result.data


@router.put("/api/blocks/{block_id}", response_model=BlockResponse)
async def update_block(
    block_id: str,
    body: BlockUpdate,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    block_data = verify_block_ownership(db, block_id, user_id)

    if (
        block_data.get("type") == "image"
        and body.content
        and body.content.get("url") != (block_data.get("content") or {}).get("url")
    ):
        old_url = (block_data.get("content") or {}).get("url", "")
        if old_url:
            delete_image_by_url(db, old_url)

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        db.table("blocks").update(update_data).eq("id", block_id).execute()
    )
    return result.data[0]


@router.put("/api/blocks/{block_id}/layout", response_model=BlockResponse)
async def update_block_layout(
    block_id: str,
    body: BlockLayoutUpdate,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    verify_block_ownership(db, block_id, user_id)

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        db.table("blocks").update(update_data).eq("id", block_id).execute()
    )
    return result.data[0]


@router.delete("/api/blocks/{block_id}")
async def delete_block(
    block_id: str,
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    block_data = verify_block_ownership(db, block_id, user_id)

    if block_data.get("type") == "image":
        url = (block_data.get("content") or {}).get("url", "")
        if url:
            delete_image_by_url(db, url)

    db.table("blocks").delete().eq("id", block_id).execute()
    return {"ok": True}
