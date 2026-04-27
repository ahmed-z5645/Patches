from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import profiles, posts, blocks, upload, follows, feed

settings = get_settings()

app = FastAPI(title="Edition API", version="0.1.0")

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


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
