import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import profiles, posts, blocks, upload, follows, feed, search, notifications
from app.routers import push
from app.services.push_notifications import create_scheduler

settings = get_settings()
TEST_MODE = os.getenv("EDITION_TEST_MODE") == "1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if TEST_MODE:
        # Skip the reminder scheduler in test mode — its only effect is firing
        # push notifications on cron triggers, which we don't want during e2e.
        yield
        return
    scheduler = create_scheduler()
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Edition API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router)
app.include_router(posts.router)
app.include_router(blocks.router)
app.include_router(upload.router)
app.include_router(follows.router)
app.include_router(feed.router)
app.include_router(search.router)
app.include_router(notifications.router)
app.include_router(push.router)


if TEST_MODE:
    # Wire the in-memory store + auth bypass. Mount the /__test__ shim so the
    # Playwright fixtures can freeze the clock and seed state.
    from app.auth import get_current_user, get_optional_user
    from app.deps import get_db
    from app.routers import _test_only
    from app.test_store import STORE

    def _test_get_db():
        return STORE

    async def _test_get_current_user(authorization: str | None = None):
        # In test mode the bearer token IS the user id (issued by /__test__/seed-user).
        # Read it directly off the raw header so we don't depend on HTTPBearer parsing.
        from fastapi import Header, HTTPException
        raise NotImplementedError  # replaced by the closure below

    # Build closures that read the bearer header directly. Importing Header
    # inside the function would re-trigger the dependency machinery; instead
    # we use Request to keep this self-contained.
    from fastapi import Request, HTTPException

    async def _test_current_user_dep(request: Request) -> str:
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="missing bearer token")
        return auth.split(" ", 1)[1].strip()

    async def _test_optional_user_dep(request: Request) -> str | None:
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return None
        return auth.split(" ", 1)[1].strip()

    app.dependency_overrides[get_db] = _test_get_db
    app.dependency_overrides[get_current_user] = _test_current_user_dep
    app.dependency_overrides[get_optional_user] = _test_optional_user_dep

    app.include_router(_test_only.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "test_mode": TEST_MODE}
