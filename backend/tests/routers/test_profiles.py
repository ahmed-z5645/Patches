import pytest
from tests.conftest import (
    TEST_USER_ID,
    OTHER_USER_ID,
    SAMPLE_PROFILE,
)


def test_get_my_profile_success(client, mock_db):
    mock_db.set_response([SAMPLE_PROFILE])
    r = client.get("/api/profiles/me")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == TEST_USER_ID
    assert data["username"] == "testuser"


def test_get_my_profile_not_found(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/profiles/me")
    assert r.status_code == 404


def test_update_profile_display_name(client, mock_db):
    updated = {**SAMPLE_PROFILE, "display_name": "Updated Name"}
    mock_db.set_response([updated])
    r = client.put("/api/profiles/me", json={"display_name": "Updated Name"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Updated Name"


def test_update_profile_no_fields_returns_400(client, mock_db):
    # model_dump(exclude_none=True) on an all-None payload → empty dict → 400
    r = client.put("/api/profiles/me", json={})
    assert r.status_code == 400


def test_update_profile_username_conflict(client, mock_db):
    # Username check returns another user with the same username
    mock_db.set_response([{"id": OTHER_USER_ID}])
    r = client.put("/api/profiles/me", json={"username": "taken"})
    assert r.status_code == 409


def test_update_profile_username_available(client, mock_db):
    updated = {**SAMPLE_PROFILE, "username": "newname"}
    # 1. uniqueness check → no conflict
    mock_db.set_response([])
    # 2. update
    mock_db.set_response([updated])
    r = client.put("/api/profiles/me", json={"username": "newname"})
    assert r.status_code == 200
    assert r.json()["username"] == "newname"


def test_update_profile_going_public_auto_accepts_follows(client, mock_db):
    private_profile = {**SAMPLE_PROFILE, "is_public": False}
    public_profile = {**SAMPLE_PROFILE, "is_public": True}

    # 1. current is_public check → was private
    mock_db.set_response([private_profile])
    # 2. update profile
    mock_db.set_response([public_profile])
    # 3. get pending follow requests
    mock_db.set_response([{"follower_id": OTHER_USER_ID}])
    # 4. bulk-accept follows
    mock_db.set_response([])
    # 5. insert notifications
    mock_db.set_response([])

    r = client.put("/api/profiles/me", json={"is_public": True})
    assert r.status_code == 200
    assert r.json()["is_public"] is True
    # notifications were inserted
    assert mock_db._last_insert_table == "notifications"


def test_get_public_profile_success(client, mock_db):
    mock_db.set_response([SAMPLE_PROFILE])
    r = client.get("/api/profiles/testuser")
    assert r.status_code == 200
    assert r.json()["username"] == "testuser"


def test_get_public_profile_not_found(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/profiles/nobody")
    assert r.status_code == 404
