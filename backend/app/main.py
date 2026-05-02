from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import profiles, posts, blocks, upload, follows, feed, search, notifications
from app.routers import push
from app.services.push_notifications import create_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
