import pytest
from app.services.weeks import get_edition_week
from tests.conftest import (
    TEST_USER_ID,
    OTHER_USER_ID,
    TEST_POST_ID,
    SAMPLE_POST as _SAMPLE_POST,
    PUBLISHED_POST as _PUBLISHED_POST,
    SAMPLE_BLOCK,
)

# Pin SAMPLE_POST to the current edition week so can_target_week() permits
# publish/create. Hardcoding a calendar week (as the conftest does) would
# silently rot every Monday.
_CW, _CY = get_edition_week()
SAMPLE_POST = {**_SAMPLE_POST, "week_number": _CW, "year": _CY}
PUBLISHED_POST = {**_PUBLISHED_POST, "week_number": _CW, "year": _CY}


def test_create_post_new(client, mock_db):
    # No existing post for this week
    mock_db.set_response([])
    mock_db.set_response([SAMPLE_POST])
    r = client.post("/api/posts", json={"week_number": _CW, "year": _CY})
    assert r.status_code == 200
    data = r.json()
    assert data["user_id"] == TEST_USER_ID
    assert data["week_number"] == _CW


def test_create_post_idempotent(client, mock_db):
    # Existing post found → return it, no insert
    mock_db.set_response([SAMPLE_POST])
    r = client.post("/api/posts", json={"week_number": _CW, "year": _CY})
    assert r.status_code == 200
    assert r.json()["id"] == TEST_POST_ID
    assert mock_db._last_insert is None  # no insert was made


def test_get_current_week_post_existing(client, mock_db):
    mock_db.set_response([SAMPLE_POST])
    r = client.get("/api/posts/me/current-week")
    assert r.status_code == 200
    assert r.json()["id"] == TEST_POST_ID


def test_get_current_week_post_creates_if_missing(client, mock_db):
    mock_db.set_response([])        # no existing post
    mock_db.set_response([SAMPLE_POST])  # insert result
    r = client.get("/api/posts/me/current-week")
    assert r.status_code == 200
    assert mock_db._last_insert_table == "posts"


def test_get_post_by_owner(client, mock_db):
    post_with_profile = {
        **SAMPLE_POST,
        "profiles": {"username": "testuser", "display_name": None, "avatar_url": None},
        "blocks": [SAMPLE_BLOCK],
    }
    mock_db.set_response([post_with_profile])
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 200
    assert "blocks" in r.json()
    assert len(r.json()["blocks"]) == 1


def test_get_post_unpublished_non_owner_forbidden(client, mock_db):
    other_post = {**SAMPLE_POST, "user_id": OTHER_USER_ID, "is_published": False, "profiles": None}
    mock_db.set_response([other_post])
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 403


def test_get_post_private_author_non_follower_forbidden(client, mock_db):
    # Published post on a private account; viewer does NOT follow → 403
    other_post = {
        **PUBLISHED_POST,
        "user_id": OTHER_USER_ID,
        "week_number": _CW, "year": _CY,
        "profiles": {"username": "priv", "display_name": None, "avatar_url": None, "is_public": False},
        "blocks": [],
    }
    mock_db.set_response([other_post])
    mock_db.set_response([])  # follows lookup → no accepted relationship
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 403


def test_get_post_private_author_accepted_follower_allowed(client, mock_db):
    # Same setup, but viewer IS an accepted follower → allowed (also unlocked
    # for current week so reveal check passes).
    other_post = {
        **PUBLISHED_POST,
        "user_id": OTHER_USER_ID,
        "week_number": _CW, "year": _CY,
        "profiles": {"username": "priv", "display_name": None, "avatar_url": None, "is_public": False},
        "blocks": [],
    }
    mock_db.set_response([other_post])
    mock_db.set_response([{"status": "accepted"}])    # follow exists
    mock_db.set_response([{"id": "viewer-post"}])     # is_week_unlocked → yes
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 200


def test_get_post_public_author_current_week_viewer_unlocked_allowed(client, mock_db):
    # Public account, current week (unrevealed), viewer has published → allowed.
    other_post = {
        **PUBLISHED_POST,
        "user_id": OTHER_USER_ID,
        "week_number": _CW, "year": _CY,
        "profiles": {"username": "pub", "display_name": None, "avatar_url": None, "is_public": True},
        "blocks": [],
    }
    mock_db.set_response([other_post])
    mock_db.set_response([{"id": "viewer-post"}])    # is_week_unlocked → yes
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 200


def test_get_post_public_author_current_week_viewer_locked_forbidden(client, mock_db):
    # Public account, current week (unrevealed), viewer has NOT published → 403.
    other_post = {
        **PUBLISHED_POST,
        "user_id": OTHER_USER_ID,
        "week_number": _CW, "year": _CY,
        "profiles": {"username": "pub", "display_name": None, "avatar_url": None, "is_public": True},
        "blocks": [],
    }
    mock_db.set_response([other_post])
    mock_db.set_response([])    # is_week_unlocked → no
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 403


def test_get_post_not_found(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/posts/nonexistent")
    assert r.status_code == 404


def test_update_post(client, mock_db):
    updated = {**SAMPLE_POST, "title": "New Title"}
    mock_db.set_response([SAMPLE_POST])    # fetch post (ownership check)
    mock_db.set_response([updated])        # update result
    r = client.put(f"/api/posts/{TEST_POST_ID}", json={"title": "New Title"})
    assert r.status_code == 200
    assert r.json()["title"] == "New Title"


def test_update_post_not_found(client, mock_db):
    mock_db.set_response([])
    r = client.put(f"/api/posts/{TEST_POST_ID}", json={"title": "x"})
    assert r.status_code == 404


def test_publish_post_no_title(client, mock_db):
    no_title = {**SAMPLE_POST, "title": None}
    mock_db.set_response([no_title])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 400
    assert "title" in r.json()["detail"].lower()


def test_publish_post_insufficient_words(client, mock_db):
    with_title = {**SAMPLE_POST, "title": "My Post"}
    short_block = {**SAMPLE_BLOCK, "content": {"markdown": "too short"}}
    mock_db.set_response([with_title])     # fetch post
    mock_db.set_response([short_block])   # calculate_word_count fetches blocks
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 400
    assert "100 words" in r.json()["detail"]


def test_publish_post_success(client, mock_db):
    with_title = {**SAMPLE_POST, "title": "My Week"}
    long_text = "word " * 110
    long_block = {**SAMPLE_BLOCK, "content": {"markdown": long_text}}
    published = {**with_title, "is_published": True, "word_count": 110}

    mock_db.set_response([with_title])       # fetch post
    mock_db.set_response([long_block])       # calculate_word_count
    mock_db.set_response([published])        # update post
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 200
    assert r.json()["is_published"] is True
    assert mock_db._last_update["is_published"] is True


# ---------------------------------------------------------------------------
# Publish validation edges — pin the contract before the cost refactor.
# ---------------------------------------------------------------------------

def test_publish_post_empty_string_title_rejected(client, mock_db):
    empty_title = {**SAMPLE_POST, "title": ""}
    mock_db.set_response([empty_title])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 400
    assert "title" in r.json()["detail"].lower()


def test_publish_post_whitespace_only_title_rejected(client, mock_db):
    ws_title = {**SAMPLE_POST, "title": "   \t  "}
    mock_db.set_response([ws_title])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 400
    assert "title" in r.json()["detail"].lower()


def test_publish_post_99_words_rejected(client, mock_db):
    with_title = {**SAMPLE_POST, "title": "Almost"}
    short_block = {**SAMPLE_BLOCK, "content": {"markdown": " ".join(["word"] * 99)}}
    mock_db.set_response([with_title])
    mock_db.set_response([short_block])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 400
    assert "100 words" in r.json()["detail"]
    assert "99" in r.json()["detail"]


def test_publish_post_exactly_100_words_accepted(client, mock_db):
    with_title = {**SAMPLE_POST, "title": "Exactly Enough"}
    block_100 = {**SAMPLE_BLOCK, "content": {"markdown": " ".join(["word"] * 100)}}
    published = {**with_title, "is_published": True, "word_count": 100}
    mock_db.set_response([with_title])
    mock_db.set_response([block_100])
    mock_db.set_response([published])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 200
    assert mock_db._last_update["word_count"] == 100


def test_publish_post_word_count_sums_across_multiple_markdown_blocks(client, mock_db):
    with_title = {**SAMPLE_POST, "title": "Multi-block"}
    block_a = {**SAMPLE_BLOCK, "id": "b-a", "content": {"markdown": " ".join(["word"] * 60)}}
    block_b = {**SAMPLE_BLOCK, "id": "b-b", "content": {"markdown": " ".join(["word"] * 41)}}
    published = {**with_title, "is_published": True, "word_count": 101}
    mock_db.set_response([with_title])
    # calculate_word_count makes one query that returns ALL markdown blocks for the post
    mock_db.set_response([block_a, block_b])
    mock_db.set_response([published])
    r = client.post(f"/api/posts/{TEST_POST_ID}/publish")
    assert r.status_code == 200
    assert mock_db._last_update["word_count"] == 101
