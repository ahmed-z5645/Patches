import pytest
from tests.conftest import (
    TEST_USER_ID,
    OTHER_USER_ID,
    TEST_POST_ID,
    TEST_BLOCK_ID,
    SAMPLE_BLOCK,
)

BLOCK_WITH_POST = {**SAMPLE_BLOCK, "posts": {"user_id": TEST_USER_ID}}
OTHER_BLOCK = {**SAMPLE_BLOCK, "id": "other-block-id", "posts": {"user_id": OTHER_USER_ID}}


def test_create_block(client, mock_db):
    # verify_post_ownership check, then insert
    mock_db.set_response([{"user_id": TEST_USER_ID}])
    mock_db.set_response([SAMPLE_BLOCK])
    r = client.post(
        f"/api/posts/{TEST_POST_ID}/blocks",
        json={
            "type": "markdown",
            "content": {"markdown": "Hello"},
            "grid_layout_desktop": {"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 2},
            "grid_layout_mobile": {"colStart": 1, "colSpan": 1, "rowStart": 1, "rowSpan": 2},
        },
    )
    assert r.status_code == 200
    assert r.json()["type"] == "markdown"


def test_create_block_wrong_owner(client, mock_db):
    mock_db.set_response([{"user_id": OTHER_USER_ID}])
    r = client.post(
        f"/api/posts/{TEST_POST_ID}/blocks",
        json={"type": "markdown", "content": {}, "grid_layout_desktop": {}, "grid_layout_mobile": {}},
    )
    assert r.status_code == 404


def test_get_blocks(client, mock_db):
    mock_db.set_response([{"user_id": TEST_USER_ID}])   # ownership
    mock_db.set_response([SAMPLE_BLOCK])                 # blocks list
    r = client.get(f"/api/posts/{TEST_POST_ID}/blocks")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert r.json()[0]["id"] == TEST_BLOCK_ID


def test_update_block_content(client, mock_db):
    updated = {**SAMPLE_BLOCK, "content": {"markdown": "Updated"}}
    mock_db.set_response([BLOCK_WITH_POST])   # verify ownership
    mock_db.set_response([updated])           # update result
    r = client.put(
        f"/api/blocks/{TEST_BLOCK_ID}",
        json={"content": {"markdown": "Updated"}},
    )
    assert r.status_code == 200
    assert r.json()["content"]["markdown"] == "Updated"


def test_update_block_wrong_owner(client, mock_db):
    mock_db.set_response([OTHER_BLOCK])
    r = client.put(f"/api/blocks/{TEST_BLOCK_ID}", json={"content": {"markdown": "x"}})
    assert r.status_code == 403


def test_update_image_block_deletes_old_url(client, mock_db):
    old_url = "https://test.supabase.co/storage/v1/object/public/images/test-user-id/old.png"
    image_block = {
        **SAMPLE_BLOCK,
        "type": "image",
        "content": {"url": old_url},
        "posts": {"user_id": TEST_USER_ID},
    }
    updated_block = {**image_block, "content": {"url": "https://test.supabase.co/storage/v1/object/public/images/test-user-id/new.png"}}
    mock_db.set_response([image_block])   # verify ownership
    mock_db.set_response([updated_block]) # update result

    r = client.put(
        f"/api/blocks/{TEST_BLOCK_ID}",
        json={"content": {"url": "https://test.supabase.co/storage/v1/object/public/images/test-user-id/new.png"}},
    )
    assert r.status_code == 200
    removed = mock_db.storage._builders.get("images", None)
    assert removed is not None
    assert any("old.png" in p for p in removed.removed_paths)


def test_update_block_layout(client, mock_db):
    updated = {**SAMPLE_BLOCK, "grid_layout_desktop": {"colStart": 2, "colSpan": 1, "rowStart": 1, "rowSpan": 2}}
    mock_db.set_response([BLOCK_WITH_POST])   # verify ownership
    mock_db.set_response([updated])           # update result
    r = client.put(
        f"/api/blocks/{TEST_BLOCK_ID}/layout",
        json={"grid_layout_desktop": {"colStart": 2, "colSpan": 1, "rowStart": 1, "rowSpan": 2}},
    )
    assert r.status_code == 200


def test_delete_block(client, mock_db):
    mock_db.set_response([BLOCK_WITH_POST])   # verify ownership
    r = client.delete(f"/api/blocks/{TEST_BLOCK_ID}")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert mock_db._last_delete_table == "blocks"


def test_delete_image_block_removes_from_storage(client, mock_db):
    img_url = "https://test.supabase.co/storage/v1/object/public/images/test-user-id/img.png"
    image_block = {
        **SAMPLE_BLOCK,
        "type": "image",
        "content": {"url": img_url},
        "posts": {"user_id": TEST_USER_ID},
    }
    mock_db.set_response([image_block])
    r = client.delete(f"/api/blocks/{TEST_BLOCK_ID}")
    assert r.status_code == 200
    removed = mock_db.storage._builders.get("images", None)
    assert removed is not None
    assert any("img.png" in p for p in removed.removed_paths)
