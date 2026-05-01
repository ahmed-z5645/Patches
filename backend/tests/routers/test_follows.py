import pytest
from tests.conftest import TEST_USER_ID, OTHER_USER_ID

OTHER_PROFILE = {
    "id": OTHER_USER_ID,
    "username": "otheruser",
    "display_name": "Other User",
    "avatar_url": None,
    "is_following_back": False,
}

PUBLIC_PROFILE_ROW = {"is_public": True}
PRIVATE_PROFILE_ROW = {"is_public": False}


def test_follow_public_user(client, mock_db):
    mock_db.set_response([])                      # no existing follow
    mock_db.set_response([PUBLIC_PROFILE_ROW])    # profile is_public check
    mock_db.set_response([])                      # insert follow
    mock_db.set_response([])                      # insert notification
    r = client.post(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "followed"
    assert mock_db._last_insert_table == "notifications"


def test_follow_private_user(client, mock_db):
    mock_db.set_response([])                       # no existing follow
    mock_db.set_response([PRIVATE_PROFILE_ROW])   # profile is_public check
    mock_db.set_response([])                       # insert follow (pending)
    mock_db.set_response([])                       # insert notification (follow_request)
    r = client.post(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "requested"


def test_follow_self_returns_400(client, mock_db):
    r = client.post(f"/api/follows/{TEST_USER_ID}")
    assert r.status_code == 400
    assert "yourself" in r.json()["detail"].lower()


def test_follow_already_following(client, mock_db):
    mock_db.set_response([{"status": "accepted"}])
    r = client.post(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "already_following"


def test_follow_already_requested(client, mock_db):
    mock_db.set_response([{"status": "pending"}])
    r = client.post(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "already_requested"


def test_follow_after_rejection_re_requests(client, mock_db):
    mock_db.set_response([{"status": "rejected"}])    # existing rejected row
    mock_db.set_response([])                           # update to pending
    mock_db.set_response([])                           # insert notification
    r = client.post(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "requested"
    assert mock_db._last_update == {"status": "pending"}


def test_follow_user_not_found(client, mock_db):
    mock_db.set_response([])    # no existing follow
    mock_db.set_response([])    # profile lookup → empty
    r = client.post(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 404


def test_unfollow_user(client, mock_db):
    mock_db.set_response([])   # delete follow
    mock_db.set_response([])   # delete notification
    r = client.delete(f"/api/follows/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "unfollowed"


def test_get_follow_requests(client, mock_db):
    request_row = {"follower_id": OTHER_USER_ID, "profiles": OTHER_PROFILE}
    mock_db.set_response([request_row])
    r = client.get("/api/follows/requests")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["username"] == "otheruser"


def test_accept_follow_request(client, mock_db):
    mock_db.set_response([{"follower_id": OTHER_USER_ID, "following_id": TEST_USER_ID, "status": "pending"}])  # pending check
    mock_db.set_response([])   # update to accepted
    mock_db.set_response([])   # delete follow_request notification
    mock_db.set_response([])   # insert follow_accepted notification
    r = client.post(f"/api/follows/requests/{OTHER_USER_ID}/accept")
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    assert mock_db._last_insert == {
        "user_id": OTHER_USER_ID,
        "actor_id": TEST_USER_ID,
        "type": "follow_accepted",
    }


def test_accept_follow_request_not_found(client, mock_db):
    mock_db.set_response([])
    r = client.post(f"/api/follows/requests/{OTHER_USER_ID}/accept")
    assert r.status_code == 404


def test_reject_follow_request(client, mock_db):
    mock_db.set_response([{"follower_id": OTHER_USER_ID, "following_id": TEST_USER_ID, "status": "pending"}])
    mock_db.set_response([])   # delete follow row
    mock_db.set_response([])   # delete notification
    r = client.post(f"/api/follows/requests/{OTHER_USER_ID}/reject")
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


def test_check_following_status_not_following(client, mock_db):
    mock_db.set_response([])
    r = client.get(f"/api/follows/check/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json() == {"is_following": False, "status": None}


def test_check_following_status_accepted(client, mock_db):
    mock_db.set_response([{"status": "accepted"}])
    r = client.get(f"/api/follows/check/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json() == {"is_following": True, "status": "accepted"}


def test_check_following_status_pending(client, mock_db):
    mock_db.set_response([{"status": "pending"}])
    r = client.get(f"/api/follows/check/{OTHER_USER_ID}")
    assert r.status_code == 200
    assert r.json() == {"is_following": False, "status": "pending"}


def test_get_followers(client, mock_db):
    follower_row = {"follower_id": OTHER_USER_ID, "profiles": {**OTHER_PROFILE}}
    mock_db.set_response([follower_row])   # followers query
    mock_db.set_response([])              # following_back check
    r = client.get("/api/follows/followers")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["username"] == "otheruser"
    assert data[0]["is_following_back"] is False


def test_get_following(client, mock_db):
    following_row = {"following_id": OTHER_USER_ID, "profiles": OTHER_PROFILE}
    mock_db.set_response([following_row])
    r = client.get("/api/follows/following")
    assert r.status_code == 200
    assert len(r.json()) == 1
