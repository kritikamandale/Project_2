"""
FastAPI injectable dependencies — auth, DB session, Redis, role guards.
"""

from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token

security = HTTPBearer()

# ---------------------------------------------------------------------------
# Redis client (shared pool)
# ---------------------------------------------------------------------------

_redis_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await aioredis.from_url(
            str(settings.redis_url),
            encoding="utf-8",
            decode_responses=True,
        )
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
    except JWTError:
        raise credentials_exception

    # JTI revocation check (set on logout or password reset)
    if await redis.get(f"revoked_jti:{jti}"):
        raise credentials_exception

    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

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


require_user = require_role("USER", "DERMATOLOGIST", "ADMIN")
require_dermatologist = require_role("DERMATOLOGIST", "ADMIN")
require_admin = require_role("ADMIN")


# ---------------------------------------------------------------------------
# Request metadata helpers
# ---------------------------------------------------------------------------

def get_client_ip(request: Request) -> str:
    """Extract real IP respecting X-Forwarded-For from proxies/load balancers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    return request.headers.get("User-Agent", "")
