"""Pytest fixtures — async test DB, test client, auth helpers."""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.dependencies import get_redis
# security.py exposes hash_password (not get_password_hash) and
# create_access_token(user_id, role, email) -> (token, jti).
from app.core.security import hash_password as get_password_hash, create_access_token
from app.models.user import AuditLog, RefreshToken, User, UserProfile

TEST_DATABASE_URL = "postgresql+asyncpg://skin_user:password@localhost:5432/skin_analysis_test"


# ---------------------------------------------------------------------------
# Event loop & DB engine (session-scoped)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# Redis mock (avoids requiring a live Redis in unit tests)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.setex = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.exists = AsyncMock(return_value=0)
    redis.incr = AsyncMock(return_value=1)
    redis.expire = AsyncMock(return_value=True)
    redis.keys = AsyncMock(return_value=[])
    redis.ttl = AsyncMock(return_value=900)
    return redis


# ---------------------------------------------------------------------------
# HTTP test client
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(db_session, mock_redis) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    async def override_get_redis():
        return mock_redis

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# User creation helpers
# ---------------------------------------------------------------------------

async def create_test_user(
    db: AsyncSession,
    *,
    email: str = None,
    password: str = "SecurePass123!",
    role: str = "USER",
    is_verified: bool = True,
    full_name: str = "Test User",
) -> User:
    email = email or f"test_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role,
        is_verified=is_verified,
    )
    db.add(user)
    profile = UserProfile(user=user, city="Mumbai", country="India")
    db.add(profile)
    await db.flush()
    return user


@pytest_asyncio.fixture
async def regular_user(db_session) -> User:
    user = await create_test_user(db_session, email="user@test.com")
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def admin_user(db_session) -> User:
    user = await create_test_user(
        db_session,
        email="admin@test.com",
        role="ADMIN",
        full_name="Admin User",
    )
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def dermatologist_user(db_session) -> User:
    user = await create_test_user(
        db_session,
        email="derm@test.com",
        role="DERMATOLOGIST",
        full_name="Dr. Test",
    )
    await db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def make_access_token(user: User) -> str:
    token, _jti = create_access_token(user.id, user.role, user.email)
    return token


@pytest.fixture
def user_token(regular_user) -> str:
    return make_access_token(regular_user)


@pytest.fixture
def admin_token(admin_user) -> str:
    return make_access_token(admin_user)


@pytest.fixture
def derm_token(dermatologist_user) -> str:
    return make_access_token(dermatologist_user)


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
