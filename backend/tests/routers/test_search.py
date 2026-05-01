import pytest
from tests.conftest import TEST_USER_ID


def test_search_users(client, mock_db):
    mock_db.set_response([{"id": "u1", "username": "alice"}])
    r = client.get("/api/search/users?q=alice")
    assert r.status_code == 200
    assert r.json()[0]["username"] == "alice"
    assert len(mock_db._rpc_calls) == 1
    call = mock_db._rpc_calls[0]
    assert call["name"] == "search_users"
    assert call["params"]["query_text"] == "alice"
    assert call["params"]["caller_id"] == TEST_USER_ID


def test_search_posts(client, mock_db):
    mock_db.set_response([{"id": "p1", "title": "My Week"}])
    r = client.get("/api/search/posts?q=week")
    assert r.status_code == 200
    assert r.json()[0]["title"] == "My Week"
    assert len(mock_db._rpc_calls) == 1
    call = mock_db._rpc_calls[0]
    assert call["name"] == "search_posts"
    assert call["params"]["query_text"] == "week"
    assert call["params"]["caller_id"] == TEST_USER_ID


def test_search_users_empty_results(client, mock_db):
    mock_db.set_response([])
    r = client.get("/api/search/users?q=nobody")
    assert r.status_code == 200
    assert r.json() == []


def test_search_users_missing_query_returns_422(client, mock_db):
    r = client.get("/api/search/users")
    assert r.status_code == 422


def test_search_posts_missing_query_returns_422(client, mock_db):
    r = client.get("/api/search/posts")
    assert r.status_code == 422
