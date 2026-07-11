"""
FastAPI injectable dependencies — auth, DB session, Redis, role guards.
"""

import logging
import time
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError as JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import apply_rls_context, get_db, set_rls_bypass, set_rls_user_id
from app.core.security import decode_access_token

# Roles that legitimately read/write rows across users (review queues, analytics)
# and therefore bypass per-user RLS via the service_bypass policy.
_RLS_BYPASS_ROLES = frozenset({"ADMIN", "DERMATOLOGIST"})

logger = logging.getLogger(__name__)
security = HTTPBearer()

# ---------------------------------------------------------------------------
# Redis client (shared pool) — falls back to an in-process fake in dev mode
# when no real Redis is reachable, so local auth flows (OTP, lockouts) don't
# require running infrastructure.
# ---------------------------------------------------------------------------


class _FakeRedis:
    """Minimal in-memory stand-in for the handful of redis-py calls this app uses."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float | None]] = {}

    def _live(self, key: str) -> str | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at is not None and expires_at < time.monotonic():
            del self._store[key]
            return None
        return value

    async def get(self, key: str) -> str | None:
        return self._live(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        expires_at = time.monotonic() + ex if ex is not None else None
        self._store[key] = (str(value), expires_at)

    async def incr(self, key: str) -> int:
        current = int(self._live(key) or 0) + 1
        _, expires_at = self._store.get(key, (None, None))
        self._store[key] = (str(current), expires_at)
        return current

    async def expire(self, key: str, ttl_seconds: int) -> None:
        entry = self._store.get(key)
        if entry is not None:
            self._store[key] = (entry[0], time.monotonic() + ttl_seconds)

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self._store.pop(key, None)

    async def keys(self, pattern: str) -> list[str]:
        prefix = pattern.rstrip("*")
        return [k for k in self._store if k.startswith(prefix)]


_redis_pool: aioredis.Redis | _FakeRedis | None = None


async def get_redis() -> aioredis.Redis | _FakeRedis:
    global _redis_pool
    if _redis_pool is None:
        candidate = aioredis.from_url(
            str(settings.redis_url),
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        try:
            await candidate.ping()
            _redis_pool = candidate
        except Exception as exc:
            if not settings.is_development:
                raise
            logger.warning(
                "Redis unavailable on first use (dev mode) — %s. "
                "Falling back to an in-memory store; OTPs/lockouts won't persist across restarts.", exc
            )
            _redis_pool = _FakeRedis()
    return _redis_pool


# ---------------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    """
    Decode RS256/HS256 JWT, check jti revocation list, return User ORM row.
    Raises 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str | None = payload.get("sub")
        jti: str | None = payload.get("jti")
        if not user_id or not jti:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    # Publish the user id for RLS BEFORE the first query so the whole request
    # transaction is scoped to this user's rows at the database layer.
    set_rls_user_id(user_id)

    # JTI revocation check (set on logout or password reset)
    if await redis.get(f"revoked_jti:{jti}"):
        raise credentials_exception

    from app.models.user import User

    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # Now that the role is known, allow cross-user access for admin/derm and push
    # the updated RLS context onto the transaction the query above already opened.
    if user.role in _RLS_BYPASS_ROLES:
        set_rls_bypass(True)
    await apply_rls_context(db)

    return user


async def get_current_verified_user(
    user=Depends(get_current_user),
):
    """Like get_current_user but additionally requires email to be verified."""
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required",
        )
    return user


# ---------------------------------------------------------------------------
# Role guards
# ---------------------------------------------------------------------------

def require_role(*roles: str):
    async def _guard(current_user=Depends(get_current_verified_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return _guard


require_user = require_role("USER", "DERMATOLOGIST")
require_dermatologist = require_role("DERMATOLOGIST")
require_admin = require_role("ADMIN")


# ---------------------------------------------------------------------------
# Request metadata helpers
# ---------------------------------------------------------------------------

def get_client_ip(request: Request) -> str:
    """
    Return the caller's IP.

    X-Forwarded-For is only honoured when settings.trust_proxy_headers is true
    (i.e. the API genuinely sits behind a trusted reverse proxy). Otherwise the
    header is client-controlled and must not be trusted, so we fall back to the
    real socket peer to prevent IP spoofing of rate limits and audit logs.
    """
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    return request.headers.get("User-Agent", "")
