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
    # New query order: following → is_week_unlocked → post count
    mock_db.set_response(FOLLOWING_ROW)                    # following
    mock_db.set_response([])                               # is_week_unlocked → none
    from tests.conftest import MockResponse
    mock_db._responses.append(MockResponse(data=[], count=2))  # post count

    r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 2
    assert "week" in body and "year" in body


def test_feed_unlocked_when_user_has_published(client, mock_db):
    # New: following → is_week_unlocked → posts (with blocks embedded)
    mock_db.set_response(FOLLOWING_ROW)
    mock_db.set_response([{"id": TEST_POST_ID}])
    mock_db.set_response([{**POST_WITH_PROFILE, "blocks": [SAMPLE_BLOCK]}])

    r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is False
    assert len(body["posts"]) == 1
    assert len(body["posts"][0]["blocks"]) == 1


def test_feed_past_week_always_unlocked(client, mock_db):
    # year=2025 → is_past_week True, skips unlock check.
    # New: following → posts (with blocks embedded)
    mock_db.set_response(FOLLOWING_ROW)
    mock_db.set_response([{**POST_WITH_PROFILE, "blocks": [SAMPLE_BLOCK]}])

    r = client.get("/api/feed?week=1&year=2025")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is False
    assert body["week"] == 1
    assert body["year"] == 2025


def test_feed_locked_no_following(client, mock_db):
    # New: following → (empty) → is_week_unlocked → return locked with 0
    mock_db.set_response([])             # following → empty
    mock_db.set_response([])             # is_week_unlocked → none

    r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 0


# ---------------------------------------------------------------------------
# GET /api/feed/older
# ---------------------------------------------------------------------------

def test_feed_older_returns_past_posts(client, mock_db):
    # New: following → posts (with blocks embedded)
    mock_db.set_response(FOLLOWING_ROW)
    mock_db.set_response([{**POST_WITH_PROFILE, "blocks": [SAMPLE_BLOCK]}])

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
    # New: following → posts (with blocks embedded)
    mock_db.set_response(FOLLOWING_ROW)
    post_a = {**POST_WITH_PROFILE, "id": "post-a", "week_number": 2, "year": 2025, "blocks": []}
    post_b = {**POST_WITH_PROFILE, "id": "post-b", "week_number": 3, "year": 2025, "blocks": []}
    mock_db.set_response([post_a, post_b])

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
    my_post = {**PUBLISHED_POST, "user_id": TEST_USER_ID, "blocks": [SAMPLE_BLOCK]}
    mock_db.set_response([my_post])

    r = client.get("/api/feed/my-posts")
    assert r.status_code == 200
    body = r.json()
    assert len(body["posts"]) == 1
    assert body["posts"][0]["user_id"] == TEST_USER_ID
    assert len(body["posts"][0]["blocks"]) == 1


def test_feed_my_posts_empty(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/feed/my-posts")
    assert r.status_code == 200
    assert r.json() == {"posts": []}


# ---------------------------------------------------------------------------
# Response-shape contract — pin before the N+1 refactor
# ---------------------------------------------------------------------------
# These tests pin the EXACT block ordering and post structure each feed
# endpoint returns. The Phase-2a refactor will move blocks from per-post
# .order("sort_order") queries into an embedded select with Python-side
# sorting; these tests ensure that doesn't silently re-order tiles.

def _block(block_id, sort_order, post_id=None):
    return {
        **SAMPLE_BLOCK,
        "id": block_id,
        "sort_order": sort_order,
        "post_id": post_id or TEST_POST_ID,
    }


def test_feed_unlocked_blocks_sorted_by_sort_order(client, mock_db):
    # New: blocks embedded in the post response, in reverse order — endpoint
    # must Python-sort them ascending before returning.
    mock_db.set_response(FOLLOWING_ROW)                    # following
    mock_db.set_response([{"id": TEST_POST_ID}])           # is_week_unlocked
    embedded_post = {
        **POST_WITH_PROFILE,
        "blocks": [_block("b2", 2), _block("b0", 0), _block("b1", 1)],
    }
    mock_db.set_response([embedded_post])

    r = client.get("/api/feed")
    assert r.status_code == 200
    blocks = r.json()["posts"][0]["blocks"]
    assert [b["sort_order"] for b in blocks] == [0, 1, 2], \
        "blocks must be returned in ascending sort_order"


def test_feed_my_posts_blocks_sorted(client, mock_db):
    my_post = {
        **PUBLISHED_POST,
        "user_id": TEST_USER_ID,
        "blocks": [_block("b1", 1), _block("b0", 0)],
    }
    mock_db.set_response([my_post])
    r = client.get("/api/feed/my-posts")
    assert r.status_code == 200
    blocks = r.json()["posts"][0]["blocks"]
    assert [b["sort_order"] for b in blocks] == [0, 1]


def test_feed_archive_each_post_has_blocks_in_order(client, mock_db):
    mock_db.set_response(FOLLOWING_ROW)
    post_a = {
        **POST_WITH_PROFILE, "id": "post-a", "week_number": 2, "year": 2025,
        "blocks": [_block("a1", 1, "post-a"), _block("a0", 0, "post-a")],
    }
    post_b = {
        **POST_WITH_PROFILE, "id": "post-b", "week_number": 3, "year": 2025,
        "blocks": [_block("b0", 0, "post-b")],
    }
    mock_db.set_response([post_a, post_b])

    r = client.get("/api/feed/archive")
    assert r.status_code == 200
    weeks = r.json()["weeks"]
    all_posts = [p for w in weeks for p in w["posts"]]
    assert len(all_posts) == 2
    for p in all_posts:
        assert "blocks" in p
        sort_orders = [b["sort_order"] for b in p["blocks"]]
        assert sort_orders == sorted(sort_orders), \
            f"post {p['id']} blocks not in ascending sort_order"


def test_feed_older_pagination_has_more_true(client, mock_db):
    posts = [
        {**POST_WITH_PROFILE, "id": f"p{i}", "week_number": 1, "year": 2025, "blocks": []}
        for i in range(4)
    ]
    mock_db.set_response(FOLLOWING_ROW)
    mock_db.set_response(posts)
    r = client.get("/api/feed/older?offset=0&limit=2")
    assert r.status_code == 200
    body = r.json()
    assert len(body["posts"]) == 2
    assert body["has_more"] is True


def test_feed_older_pagination_has_more_false_on_last_page(client, mock_db):
    posts = [
        {**POST_WITH_PROFILE, "id": f"p{i}", "week_number": 1, "year": 2025, "blocks": []}
        for i in range(3)
    ]
    mock_db.set_response(FOLLOWING_ROW)
    mock_db.set_response(posts)
    r = client.get("/api/feed/older?offset=0&limit=6")
    assert r.status_code == 200
    body = r.json()
    assert len(body["posts"]) == 3
    assert body["has_more"] is False


def test_feed_locked_post_count_matches_followers_published_count(client, mock_db):
    # New order: following → is_week_unlocked → post count
    mock_db.set_response(FOLLOWING_ROW)
    mock_db.set_response([])
    from tests.conftest import MockResponse
    mock_db._responses.append(MockResponse(data=[], count=2))
    r = client.get("/api/feed")
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 2
