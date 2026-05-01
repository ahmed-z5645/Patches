import pytest
from tests.conftest import (
    TEST_USER_ID,
    OTHER_USER_ID,
    TEST_POST_ID,
    SAMPLE_POST,
    PUBLISHED_POST,
    SAMPLE_BLOCK,
)


def test_create_post_new(client, mock_db):
    # No existing post for this week
    mock_db.set_response([])
    mock_db.set_response([SAMPLE_POST])
    r = client.post("/api/posts", json={"week_number": 10, "year": 2025})
    assert r.status_code == 200
    data = r.json()
    assert data["user_id"] == TEST_USER_ID
    assert data["week_number"] == 10


def test_create_post_idempotent(client, mock_db):
    # Existing post found → return it, no insert
    mock_db.set_response([SAMPLE_POST])
    r = client.post("/api/posts", json={"week_number": 10, "year": 2025})
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
    post_with_profile = {**SAMPLE_POST, "profiles": {"username": "testuser", "display_name": None, "avatar_url": None}}
    mock_db.set_response([post_with_profile])   # get post
    mock_db.set_response([SAMPLE_BLOCK])        # get blocks
    r = client.get(f"/api/posts/{TEST_POST_ID}")
    assert r.status_code == 200
    assert "blocks" in r.json()


def test_get_post_unpublished_non_owner_forbidden(client, mock_db):
    other_post = {**SAMPLE_POST, "user_id": OTHER_USER_ID, "is_published": False, "profiles": None}
    mock_db.set_response([other_post])
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
