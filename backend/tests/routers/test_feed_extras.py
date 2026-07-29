"""Additional integration tests for /api/feed.

Pins behavior not yet covered by test_feed.py:
- Locked feed reports a non-zero post_count when followees have published
- /older paginates and reports has_more correctly
- /archive groups posts by week and excludes current-or-future weeks
- /my-posts is owner-scoped, includes unpublished? (no — only published)
"""

from datetime import datetime
from unittest.mock import patch

from app.services import weeks as weeks_module
from app.services.weeks import EASTERN

from tests.conftest import TEST_USER_ID


class _FrozenDatetime(datetime):
    _frozen: datetime

    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return cls._frozen.replace(tzinfo=None)
        return cls._frozen.astimezone(tz)


def _freeze(instant: datetime):
    frozen_cls = type("_Frozen", (_FrozenDatetime,), {"_frozen": instant})
    return patch.object(weeks_module, "datetime", frozen_cls)


# ---------------------------------------------------------------------------
# /api/feed — locked state still returns count when followees published
# ---------------------------------------------------------------------------

def test_feed_locked_reports_followee_post_count(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)  # mid-week 11
    with _freeze(instant):
        # is_past_week? prior+revealed — no, current.
        mock_db.set_response([{"following_id": "u-a"}, {"following_id": "u-b"}])  # following ids
        # is_week_unlocked? no posts for viewer
        mock_db.set_response([])
        # Count query for locked-feed teaser
        from tests.conftest import MockResponse
        mock_db.set_responses([MockResponse(data=[], count=3)])
        r = client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 3


def test_feed_locked_zero_count_when_no_followees(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([])   # no follows
        mock_db.set_response([])   # is_week_unlocked → no
        r = client.get("/api/feed")
    body = r.json()
    assert body["locked"] is True
    assert body["post_count"] == 0


def test_feed_unlocked_when_user_published_current_week(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([{"following_id": "u-a"}])    # follows
        mock_db.set_response([{"id": "my-post"}])           # unlocked
        mock_db.set_response([{                             # feed posts
            "id": "p-from-followee",
            "user_id": "u-a",
            "blocks": [],
        }])
        r = client.get("/api/feed")
    body = r.json()
    assert body["locked"] is False
    assert len(body["posts"]) == 1


def test_feed_past_week_bypasses_toll(client, mock_db):
    # Frozen well into the future so any reasonable week is past+revealed.
    instant = datetime(2026, 1, 5, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([{"following_id": "u-a"}])     # follows
        mock_db.set_response([{                              # feed posts (no Toll check)
            "id": "old-post",
            "user_id": "u-a",
            "blocks": [],
        }])
        r = client.get("/api/feed?week=10&year=2025")
    body = r.json()
    assert body["locked"] is False
    assert len(body["posts"]) == 1


# ---------------------------------------------------------------------------
# /api/feed/older
# ---------------------------------------------------------------------------

def test_feed_older_empty_when_no_follows(client, mock_db):
    mock_db.set_response([])  # no follows
    r = client.get("/api/feed/older")
    body = r.json()
    assert body == {"posts": [], "has_more": False}


def test_feed_older_paginates(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)  # current = week 11/2025
    with _freeze(instant):
        mock_db.set_response([{"following_id": "u-a"}])
        # 8 past posts, page size 6
        mock_db.set_response([
            {"id": f"p{i}", "week_number": 5, "year": 2025, "blocks": []}
            for i in range(8)
        ])
        r = client.get("/api/feed/older?offset=0&limit=6")
    body = r.json()
    assert len(body["posts"]) == 6
    assert body["has_more"] is True


def test_feed_older_filters_out_current_and_future(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)  # current = 11/2025
    with _freeze(instant):
        mock_db.set_response([{"following_id": "u-a"}])
        mock_db.set_response([
            {"id": "future", "week_number": 12, "year": 2025, "blocks": []},
            {"id": "current", "week_number": 11, "year": 2025, "blocks": []},
            {"id": "past", "week_number": 10, "year": 2025, "blocks": []},
        ])
        r = client.get("/api/feed/older")
    ids = [p["id"] for p in r.json()["posts"]]
    assert ids == ["past"]


# ---------------------------------------------------------------------------
# /api/feed/archive
# ---------------------------------------------------------------------------

def test_archive_groups_by_week(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)  # current = 11/2025
    with _freeze(instant):
        mock_db.set_response([{"following_id": "u-a"}])
        mock_db.set_response([
            {"id": "p1", "week_number": 10, "year": 2025, "blocks": []},
            {"id": "p2", "week_number": 10, "year": 2025, "blocks": []},
            {"id": "p3", "week_number": 9, "year": 2025, "blocks": []},
        ])
        r = client.get("/api/feed/archive")
    weeks = r.json()["weeks"]
    assert len(weeks) == 2
    by_week = {w["week_number"]: w for w in weeks}
    assert len(by_week[10]["posts"]) == 2
    assert len(by_week[9]["posts"]) == 1


def test_archive_excludes_current_week(client, mock_db):
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)  # current = 11/2025
    with _freeze(instant):
        mock_db.set_response([{"following_id": "u-a"}])
        mock_db.set_response([
            {"id": "p-cur", "week_number": 11, "year": 2025, "blocks": []},
            {"id": "p-old", "week_number": 9, "year": 2025, "blocks": []},
        ])
        r = client.get("/api/feed/archive")
    weeks = r.json()["weeks"]
    assert len(weeks) == 1
    assert weeks[0]["week_number"] == 9


def test_archive_empty_when_no_follows(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/feed/archive")
    assert r.json() == {"weeks": []}


# ---------------------------------------------------------------------------
# /api/feed/my-posts
# ---------------------------------------------------------------------------

def test_my_posts_returns_only_published_owned(client, mock_db):
    mock_db.set_response([
        {"id": "mine-1", "user_id": TEST_USER_ID, "is_published": True, "blocks": []},
        {"id": "mine-2", "user_id": TEST_USER_ID, "is_published": True, "blocks": []},
    ])
    r = client.get("/api/feed/my-posts")
    posts = r.json()["posts"]
    assert len(posts) == 2
    assert all(p["user_id"] == TEST_USER_ID for p in posts)
