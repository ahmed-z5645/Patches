"""JWT verification regression tests.

Pins the behavior of `app.auth.get_current_user`:
- valid HS256 token signed with the configured secret → returns `sub`
- missing/malformed/bad-signature token → HTTPException(401)
- valid signature but missing `sub` claim → HTTPException(401)

JWKS network fetch is patched out so these tests are fully offline.
"""

import asyncio
from unittest.mock import patch, AsyncMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

# conftest sets SUPABASE_JWT_SECRET before app import
from app import auth as auth_module
from app.auth import get_current_user
from app.config import get_settings


SECRET = "test-jwt-secret-32-chars-minimum!"
USER_ID = "abc-123-user"


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.new_event_loop().run_until_complete(coro)


@pytest.fixture(autouse=True)
def _patch_jwks():
    # Prevent any real network call. HS256 path doesn't use JWKS but the
    # current implementation fetches it unconditionally before branching.
    with patch.object(auth_module, "_get_jwks", new=AsyncMock(return_value={"keys": []})):
        yield


def test_valid_hs256_token_returns_sub():
    token = jwt.encode(
        {"sub": USER_ID, "aud": "authenticated"},
        SECRET,
        algorithm="HS256",
    )
    result = _run(get_current_user(_creds(token), settings=get_settings()))
    assert result == USER_ID


def test_malformed_token_rejected():
    with pytest.raises(HTTPException) as exc:
        _run(get_current_user(_creds("not-a-real-token"), settings=get_settings()))
    assert exc.value.status_code == 401


def test_bad_signature_rejected():
    token = jwt.encode(
        {"sub": USER_ID, "aud": "authenticated"},
        "wrong-secret-also-32-chars-minimum!",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        _run(get_current_user(_creds(token), settings=get_settings()))
    assert exc.value.status_code == 401


def test_missing_sub_claim_rejected():
    token = jwt.encode(
        {"aud": "authenticated"},  # no sub
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        _run(get_current_user(_creds(token), settings=get_settings()))
    assert exc.value.status_code == 401


def test_wrong_audience_rejected():
    token = jwt.encode(
        {"sub": USER_ID, "aud": "anon"},  # wrong aud
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        _run(get_current_user(_creds(token), settings=get_settings()))
    assert exc.value.status_code == 401
