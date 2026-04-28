import uuid
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from supabase import Client
from app.deps import get_db, get_authenticated_user
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["upload"])

_bucket_ensured = False


def ensure_bucket(db: Client):
    global _bucket_ensured
    if _bucket_ensured:
        return
    try:
        db.storage.get_bucket("images")
    except Exception:
        db.storage.create_bucket("images", options={"public": True})
    _bucket_ensured = True


@router.post("")
async def upload_image(
    file: UploadFile = File(...),
    user_id: str = Depends(get_authenticated_user),
    db: Client = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 5MB")

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
    path = f"{user_id}/{uuid.uuid4()}.{ext}"

    content = await file.read()

    ensure_bucket(db)
    result = db.storage.from_("images").upload(path, content, {"content-type": file.content_type})

    if hasattr(result, "error") and result.error:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {result.error}")

    settings = get_settings()
    url = f"{settings.supabase_url}/storage/v1/object/public/images/{path}"
    return {"url": url}


def delete_image_by_url(db: Client, url: str):
    settings = get_settings()
    prefix = f"{settings.supabase_url}/storage/v1/object/public/images/"
    if not url.startswith(prefix):
        return
    path = url[len(prefix):]
    try:
        db.storage.from_("images").remove([path])
    except Exception as e:
        logger.warning("Failed to delete image %s: %s", path, e)
