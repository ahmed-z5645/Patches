"""Unit tests for app.services.feed.

Covers the Toll (is_week_unlocked), past-week visibility (is_past_week),
follower graph fetching (get_following_ids), and the embedded-posts query
shape (get_feed_posts + attach_sorted_blocks).

The Supabase client is replaced with MockSupabaseClient from conftest;
queued responses simulate what PostgREST would return.
"""

from datetime import datetime
from unittest.mock import patch

import pytest

from app.services import weeks as weeks_module
from app.services.feed import (
    POST_WITH_BLOCKS_SELECT,
    attach_sorted_blocks,
    get_feed_posts,
    get_following_ids,
    is_past_week,
    is_week_unlocked,
)
from app.services.weeks import EASTERN

from tests.conftest import MockSupabaseClient


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
# is_week_unlocked — the Toll predicate
# ---------------------------------------------------------------------------

def test_is_week_unlocked_returns_true_when_published_row_exists():
    db = MockSupabaseClient()
    db.set_response([{"id": "post-1"}])
    assert is_week_unlocked(db, "user-1", 10, 2025) is True


def test_is_week_unlocked_returns_false_when_no_row():
    db = MockSupabaseClient()
    db.set_response([])
    assert is_week_unlocked(db, "user-1", 10, 2025) is False


def test_is_week_unlocked_treats_null_data_as_locked():
    db = MockSupabaseClient()
    db.set_response(None)  # MockResponse will coerce to []
    assert is_week_unlocked(db, "user-1", 10, 2025) is False


# ---------------------------------------------------------------------------
# is_past_week — requires BOTH prior-week AND reveal-fired
# ---------------------------------------------------------------------------

def test_is_past_week_false_for_future_week():
    # Frozen at week 11/2025; week 12/2025 is in the future.
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(12, 2025) is False


def test_is_past_week_false_for_current_week():
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(11, 2025) is False


def test_is_past_week_true_after_reveal_for_prior_week():
    # Mon 09:01 ET of the following week — week 11 is prior and revealed.
    instant = datetime(2025, 3, 17, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(11, 2025) is True


def test_is_past_week_handles_year_boundary():
    # Mon 2025-12-29 09:05 ET = ISO 2026-W01; week 52/2025 is now prior+revealed.
    instant = datetime(2025, 12, 29, 9, 5, tzinfo=EASTERN)
    with _freeze(instant):
        assert is_past_week(52, 2025) is True


# ---------------------------------------------------------------------------
# get_following_ids
# ---------------------------------------------------------------------------

def test_get_following_ids_returns_only_accepted_ids():
    db = MockSupabaseClient()
    db.set_response([
        {"following_id": "u-a"},
        {"following_id": "u-b"},
    ])
    ids = get_following_ids(db, "me")
    assert ids == ["u-a", "u-b"]


def test_get_following_ids_empty_when_no_follows():
    db = MockSupabaseClient()
    db.set_response([])
    assert get_following_ids(db, "me") == []


# ---------------------------------------------------------------------------
# get_feed_posts
# ---------------------------------------------------------------------------

def test_get_feed_posts_short_circuits_on_empty_following_list():
    db = MockSupabaseClient()
    # No response queued — should never call execute().
    assert get_feed_posts(db, [], 10, 2025) == []


def test_get_feed_posts_returns_posts_with_sorted_blocks():
    db = MockSupabaseClient()
    db.set_response([
        {
            "id": "post-1",
            "user_id": "u-a",
            "blocks": [
                {"id": "b3", "sort_order": 3},
                {"id": "b1", "sort_order": 1},
                {"id": "b2", "sort_order": 2},
            ],
        }
    ])
    posts = get_feed_posts(db, ["u-a"], 10, 2025)
    assert len(posts) == 1
    assert [b["id"] for b in posts[0]["blocks"]] == ["b1", "b2", "b3"]


def test_post_with_blocks_select_embeds_blocks_and_profile():
    # Pin the embedding contract so callers/N+1 refactors don't silently drop it.
    assert "blocks(*)" in POST_WITH_BLOCKS_SELECT
    assert "profiles!posts_user_id_fkey" in POST_WITH_BLOCKS_SELECT


# ---------------------------------------------------------------------------
# attach_sorted_blocks
# ---------------------------------------------------------------------------

def test_attach_sorted_blocks_handles_missing_blocks_key():
    posts = [{"id": "p1"}]  # no 'blocks'
    result = attach_sorted_blocks(posts)
    assert result[0]["blocks"] == []


def test_attach_sorted_blocks_handles_none_blocks():
    posts = [{"id": "p1", "blocks": None}]
    result = attach_sorted_blocks(posts)
    assert result[0]["blocks"] == []


def test_attach_sorted_blocks_uses_zero_default_for_missing_sort_order():
    posts = [{
        "id": "p1",
        "blocks": [
            {"id": "b-no-order"},
            {"id": "b-1", "sort_order": 1},
        ],
    }]
    result = attach_sorted_blocks(posts)
    # Missing sort_order treated as 0, so b-no-order comes first.
    assert [b["id"] for b in result[0]["blocks"]] == ["b-no-order", "b-1"]
