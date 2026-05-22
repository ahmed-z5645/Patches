"""Additional integration tests for /api/posts.

Pins behavior not yet covered by test_posts.py:
- /me/editor: opens current week's post, or next week if current is published
- /me/week-options: picker contents (skip caught-up missed weeks)
- publish: closed-week rejection, late-flag setting, cross-user 404
- update: cross-user 404
- create: rejects out-of-window weeks
"""

from datetime import datetime
from unittest.mock import patch

from app.services import weeks as weeks_module
from app.services.weeks import EASTERN, get_edition_week

from tests.conftest import (
    OTHER_USER_ID,
    SAMPLE_BLOCK,
    SAMPLE_POST as _SAMPLE_POST,
    TEST_POST_ID,
    TEST_USER_ID,
)


_CW, _CY = get_edition_week()
SAMPLE_POST = {**_SAMPLE_POST, "week_number": _CW, "year": _CY}


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
# /me/editor
# ---------------------------------------------------------------------------

def test_get_editor_post_returns_current_week_when_not_published(client, mock_db):
    # _has_published query → empty, _get_or_create existing query → returns post
    mock_db.set_response([])                  # not yet published
    mock_db.set_response([SAMPLE_POST])       # existing post for current week
    r = client.get("/api/posts/me/editor")
    assert r.status_code == 200
    assert r.json()["week_number"] == _CW


def test_get_editor_post_advances_to_next_week_when_current_published(client, mock_db):
    next_week_post = {**SAMPLE_POST, "id": "next-post", "week_number": _CW + 1}
    mock_db.set_response([{"id": "cur"}])     # _has_published → yes
    mock_db.set_response([next_week_post])    # next week exists
    r = client.get("/api/posts/me/editor")
    assert r.status_code == 200
    assert r.json()["id"] == "next-post"


def test_get_editor_post_creates_when_no_post_exists(client, mock_db):
    mock_db.set_response([])                          # not published
    mock_db.set_response([])                          # current week not found
    mock_db.set_response([SAMPLE_POST])               # insert result
    r = client.get("/api/posts/me/editor")
    assert r.status_code == 200
    assert mock_db._last_insert_table == "posts"


# ---------------------------------------------------------------------------
# /me/week-options
# ---------------------------------------------------------------------------

def test_week_options_drops_caught_up_missed_week(client, mock_db):
    # Freeze so selectable_weeks → 3 candidates. Caught-up missed (published)
    # must be filtered; current + next remain.
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        # Order: missed=11/2025, current=12/2025, next=13/2025
        mock_db.set_response([{"id": "p-missed", "is_published": True}])   # missed: published → dropped
        mock_db.set_response([])                                            # current: none
        mock_db.set_response([])                                            # next: none
        r = client.get("/api/posts/me/week-options")
    assert r.status_code == 200
    roles = [opt["role"] for opt in r.json()]
    assert "missed" not in roles
    assert "current" in roles
    assert "next" in roles


def test_week_options_keeps_missed_when_unpublished(client, mock_db):
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([{"id": "p-missed", "is_published": False}])   # draft → keep
        mock_db.set_response([])
        mock_db.set_response([])
        r = client.get("/api/posts/me/week-options")
    by_role = {opt["role"]: opt for opt in r.json()}
    assert by_role["missed"]["is_late"] is True
    assert by_role["missed"]["unlocks_feed"] is False
    assert by_role["current"]["unlocks_feed"] is True


# ---------------------------------------------------------------------------
# create_post — out-of-window week rejection
# ---------------------------------------------------------------------------

def test_create_post_rejects_two_weeks_ahead(client, mock_db):
    mock_db.set_response([])  # no existing — falls through to can_target check
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        # Current edition week 12/2025; week 14 is out of window.
        r = client.post("/api/posts", json={"week_number": 14, "year": 2025})
    assert r.status_code == 400
    assert "allowed window" in r.json()["detail"].lower() or "outside" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# publish — late flag + closed week
# ---------------------------------------------------------------------------

def test_publish_post_sets_late_flag_when_after_deadline(client, mock_db):
    # Freeze: current week = 12; publish targets 11 (prior week, still in grace).
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        post = {**SAMPLE_POST, "week_number": 11, "year": 2025, "title": "Catching up"}
        long_block = {**SAMPLE_BLOCK, "content": {"markdown": "word " * 110}}
        mock_db.set_response([post])           # fetch post
        mock_db.set_response([long_block])     # word count blocks
        mock_db.set_response([{**post, "is_published": True, "is_late": True, "word_count": 110}])
        r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 200
    assert mock_db._last_update["is_late"] is True


def test_publish_post_rejects_closed_week(client, mock_db):
    # Current = week 13; target = week 11 (closed: current >= week+2).
    instant = datetime(2025, 3, 24, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        post = {**SAMPLE_POST, "week_number": 11, "year": 2025, "title": "Too late"}
        mock_db.set_response([post])
        r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 400
    assert "closed" in r.json()["detail"].lower()


def test_publish_post_cross_user_returns_404(client, mock_db):
    other = {**SAMPLE_POST, "user_id": OTHER_USER_ID, "title": "Theirs"}
    mock_db.set_response([other])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# update — cross-user 404
# ---------------------------------------------------------------------------

def test_update_post_cross_user_returns_404(client, mock_db):
    other = {**SAMPLE_POST, "user_id": OTHER_USER_ID}
    mock_db.set_response([other])
    r = client.put(f"/api/posts/{TEST_POST_ID}", json={"title": "Hijack"})
    assert r.status_code == 404


def test_update_post_empty_body_returns_current(client, mock_db):
    mock_db.set_response([SAMPLE_POST])
    r = client.put(f"/api/posts/{TEST_POST_ID}", json={})
    assert r.status_code == 200
    # No update applied
    assert mock_db._last_update is None
