from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import httpx
from app.config import get_settings, Settings

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

_jwks_cache: dict | None = None


async def _get_jwks(supabase_url: str) -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{supabase_url}/auth/v1/.well-known/jwks.json")
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    settings: Settings = Depends(get_settings),
) -> str:
    token = credentials.credentials
    try:
        jwks = await _get_jwks(settings.supabase_url)
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            key = None
            for k in jwks.get("keys", []):
                if k.get("kid") == header.get("kid"):
                    key = k
                    break
            if key is None:
                raise JWTError("No matching key found in JWKS")
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience="authenticated",
            )

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sub claim",
            )
        return user_id
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    settings: Settings = Depends(get_settings),
) -> str | None:
    """Best-effort caller id for endpoints that serve anonymous visitors.

    Returns the user id when a valid Bearer token is present, else None.
    Never raises — callers branch on the None case explicitly.
    """
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, settings=settings)
    except HTTPException:
        return None
