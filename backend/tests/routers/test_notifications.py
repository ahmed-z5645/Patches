import pytest
from tests.conftest import TEST_USER_ID, OTHER_USER_ID, TEST_NOTIF_ID, SAMPLE_NOTIFICATION


def test_get_notifications(client, mock_db):
    mock_db.set_response([SAMPLE_NOTIFICATION])
    r = client.get("/api/notifications")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    notif = data[0]
    assert notif["id"] == TEST_NOTIF_ID
    assert notif["type"] == "new_follower"
    # actor should be populated from the profiles join
    assert notif["actor"]["username"] == "otheruser"
    assert "profiles" not in notif


def test_get_notifications_unread_only(client, mock_db):
    mock_db.set_response([SAMPLE_NOTIFICATION])
    r = client.get("/api/notifications?unread_only=true")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_notifications_empty(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/notifications")
    assert r.status_code == 200
    assert r.json() == []


def test_get_unread_count(client, mock_db):
    from tests.conftest import MockResponse
    mock_db._responses.append(MockResponse(data=[], count=3))
    r = client.get("/api/notifications/unread-count")
    assert r.status_code == 200
    assert r.json() == {"count": 3}


def test_get_unread_count_zero(client, mock_db):
    from tests.conftest import MockResponse
    mock_db._responses.append(MockResponse(data=[], count=0))
    r = client.get("/api/notifications/unread-count")
    assert r.status_code == 200
    assert r.json() == {"count": 0}


def test_mark_notification_read(client, mock_db):
    mock_db.set_response([])
    r = client.post(f"/api/notifications/{TEST_NOTIF_ID}/read")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert mock_db._last_update == {"is_read": True}


def test_mark_all_notifications_read(client, mock_db):
    mock_db.set_response([])
    r = client.post("/api/notifications/read-all")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert mock_db._last_update == {"is_read": True}
