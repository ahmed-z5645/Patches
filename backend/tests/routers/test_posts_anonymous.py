"""Integration tests for /api/posts as an ANONYMOUS visitor.

Pins the public-profile bypass-the-Toll rules from CLAUDE.md:
- Public profile pages reach posts without auth, but the Monday 9 AM ET
  reveal embargo still applies.
- Anonymous visitors only see revealed past-week posts.
- Anonymous visitors NEVER see current-week posts (no Toll path for them).
- Unpublished posts are always 403 (even for the anonymous viewer).
- Private accounts always require an accepted-follower session.
"""

from datetime import datetime
from unittest.mock import patch

from app.services import weeks as weeks_module
from app.services.weeks import EASTERN

from tests.conftest import OTHER_USER_ID, SAMPLE_POST as _SAMPLE_POST, TEST_POST_ID


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


def _published_post(week, year, *, is_public=True):
    return {
        **_SAMPLE_POST,
        "user_id": OTHER_USER_ID,
        "week_number": week,
        "year": year,
        "is_published": True,
        "word_count": 150,
        "profiles": {
            "username": "pub" if is_public else "priv",
            "display_name": None,
            "avatar_url": None,
            "is_public": is_public,
        },
        "blocks": [],
    }


def test_anonymous_sees_revealed_past_week_post(anon_client, mock_db):
    # Frozen well after the post's reveal moment.
    instant = datetime(2026, 1, 5, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([_published_post(10, 2025, is_public=True)])
        r = anon_client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 200


def test_anonymous_blocked_from_current_week_post(anon_client, mock_db):
    # Frozen during week 11 — the post (week 11) is current and not yet revealed.
    instant = datetime(2025, 3, 12, 12, 0, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([_published_post(11, 2025, is_public=True)])
        r = anon_client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 403
    assert "not yet released" in r.json()["detail"].lower()


def test_anonymous_blocked_from_unpublished_post(anon_client, mock_db):
    instant = datetime(2026, 1, 5, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        post = {**_published_post(10, 2025), "is_published": False}
        mock_db.set_response([post])
        r = anon_client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 403


def test_anonymous_blocked_from_private_account(anon_client, mock_db):
    instant = datetime(2026, 1, 5, 9, 1, tzinfo=EASTERN)
    with _freeze(instant):
        mock_db.set_response([_published_post(10, 2025, is_public=False)])
        r = anon_client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 403


def test_anonymous_404_when_missing(anon_client, mock_db):
    mock_db.set_response([])
    r = anon_client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 404
