import pytest
from unittest.mock import patch
from tests.conftest import (
    TEST_USER_ID,
    OTHER_USER_ID,
    TEST_POST_ID,
    PUBLISHED_POST,
    SAMPLE_BLOCK,
)

FOLLOWING_ROW = [{"following_id": OTHER_USER_ID}]
POST_WITH_PROFILE = {
    **PUBLISHED_POST,
    "user_id": OTHER_USER_ID,
    "profiles": {"username": "otheruser", "display_name": None, "avatar_url": None},
}


# ---------------------------------------------------------------------------
# GET /api/feed  (current week)
# ---------------------------------------------------------------------------

def test_feed_locked_when_user_has_not_published(client, mock_db):
    # is_week_unlocked → no published post for current user
    mock_db.set_response([])
    # following IDs
    mock_db.set_response(FOLLOWING_ROW)
    # post count from followed users
    from tests.conftest import MockResponse
    mock_db._responses.append(MockResponse(data=[], count=2))

    r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 2
    assert "week" in body and "year" in body


def test_feed_unlocked_when_user_has_published(client, mock_db):
    # is_week_unlocked → has published post
    mock_db.set_response([{"id": TEST_POST_ID}])
    # get_feed_posts: following IDs
    mock_db.set_response(FOLLOWING_ROW)
    # get_feed_posts: posts from followed users
    mock_db.set_response([POST_WITH_PROFILE])
    # blocks for that post
    mock_db.set_response([SAMPLE_BLOCK])

    r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is False
    assert len(body["posts"]) == 1


def test_feed_past_week_always_unlocked(client, mock_db):
    # year=2025 is guaranteed past — is_past_week returns True, skips unlock check
    # get_feed_posts: following IDs
    mock_db.set_response(FOLLOWING_ROW)
    # posts
    mock_db.set_response([POST_WITH_PROFILE])
    # blocks
    mock_db.set_response([SAMPLE_BLOCK])

    r = client.get("/api/feed?week=1&year=2025")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is False
    assert body["week"] == 1
    assert body["year"] == 2025


def test_feed_locked_no_following(client, mock_db):
    # is_week_unlocked → no published post
    mock_db.set_response([])
    # following IDs → empty
    mock_db.set_response([])

    r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 0


# ---------------------------------------------------------------------------
# GET /api/feed/older
# ---------------------------------------------------------------------------

def test_feed_older_returns_past_posts(client, mock_db):
    # following IDs
    mock_db.set_response(FOLLOWING_ROW)
    # all posts (past week: year < current)
    mock_db.set_response([POST_WITH_PROFILE])
    # blocks for the post
    mock_db.set_response([SAMPLE_BLOCK])

    r = client.get("/api/feed/older?offset=0&limit=6")
    assert r.status_code == 200
    body = r.json()
    assert "posts" in body
    assert "has_more" in body


def test_feed_older_no_following_returns_empty(client, mock_db):
    mock_db.set_response([])   # no following
    r = client.get("/api/feed/older")
    assert r.status_code == 200
    body = r.json()
    assert body == {"posts": [], "has_more": False}


# ---------------------------------------------------------------------------
# GET /api/feed/archive
# ---------------------------------------------------------------------------

def test_feed_archive_grouped_by_week(client, mock_db):
    # following IDs
    mock_db.set_response(FOLLOWING_ROW)
    # past posts (year 2025 < current year 2026)
    post_a = {**POST_WITH_PROFILE, "id": "post-a", "week_number": 2, "year": 2025}
    post_b = {**POST_WITH_PROFILE, "id": "post-b", "week_number": 3, "year": 2025}
    mock_db.set_response([post_a, post_b])
    # blocks for post_a
    mock_db.set_response([])
    # blocks for post_b
    mock_db.set_response([])

    r = client.get("/api/feed/archive")
    assert r.status_code == 200
    body = r.json()
    assert "weeks" in body
    assert len(body["weeks"]) == 2


def test_feed_archive_no_following_returns_empty(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/feed/archive")
    assert r.status_code == 200
    assert r.json() == {"weeks": []}


# ---------------------------------------------------------------------------
# GET /api/feed/my-posts
# ---------------------------------------------------------------------------

def test_feed_my_posts(client, mock_db):
    my_post = {**PUBLISHED_POST, "user_id": TEST_USER_ID}
    mock_db.set_response([my_post])
    mock_db.set_response([SAMPLE_BLOCK])

    r = client.get("/api/feed/my-posts")
    assert r.status_code == 200
    body = r.json()
    assert len(body["posts"]) == 1
    assert body["posts"][0]["user_id"] == TEST_USER_ID


def test_feed_my_posts_empty(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/feed/my-posts")
    assert r.status_code == 200
    assert r.json() == {"posts": []}
