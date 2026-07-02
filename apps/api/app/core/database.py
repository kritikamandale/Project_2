"""
Async SQLAlchemy 2.0 engine, session factory, and Base re-export.
All models import Base from app.models.base; this module wires the engine.
"""

import uuid
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.base import Base  # noqa: F401 — re-exported for convenience

# --- Async DSN normalization -------------------------------------------------
# Supabase (and most dashboards) hand out a plain "postgresql://" URL, but the
# async engine needs an async driver ("postgresql+asyncpg://"). Without it,
# SQLAlchemy falls back to psycopg2 (sync) and raises ModuleNotFoundError.
# Coerce the scheme so the app works whatever is pasted into DATABASE_URL.
def _as_async_dsn(dsn: str) -> str:
    if dsn.startswith("postgresql+"):        # already has an explicit driver
        return dsn
    if dsn.startswith("postgresql://"):
        return "postgresql+asyncpg://" + dsn[len("postgresql://"):]
    if dsn.startswith("postgres://"):
        return "postgresql+asyncpg://" + dsn[len("postgres://"):]
    return dsn


_async_dsn = _as_async_dsn(str(settings.database_url))

# Connecting through a PgBouncer pooler in transaction mode (Supabase port 6543)
# breaks server-side prepared statements: pgbouncer reuses backend connections
# across sessions, so reused statement names collide with
# "prepared statement '__asyncpg_stmt_N__' already exists".
#   - statement_cache_size=0        -> disable asyncpg's own client-side cache
#   - prepared_statement_cache_size=0 -> disable SQLAlchemy's asyncpg dialect cache
#   - prepared_statement_name_func   -> unique name per prepare so nothing collides
# All three are harmless on a direct/session connection, so apply them whenever
# the async driver is asyncpg.
_connect_args = (
    {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
    }
    if "+asyncpg" in _async_dsn
    else {}
)

engine = create_async_engine(
    _async_dsn,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_pre_ping=True,
    echo=settings.debug,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a session, commits on success, rolls back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_all_tables() -> None:
    """Dev-only helper. In production always use Alembic migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
