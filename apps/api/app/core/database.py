"""Async SQLAlchemy 2.0 engine, session factory, and Base re-export.
All models import Base from app.models.base; this module wires the engine.
"""

import contextvars
import uuid
from typing import AsyncGenerator, Optional

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

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


def _connect_args_for(dsn: str) -> dict:
    # Connecting through a PgBouncer pooler in transaction mode (Supabase port 6543)
    # breaks server-side prepared statements: pgbouncer reuses backend connections
    # across sessions, so reused statement names collide with
    # "prepared statement '__asyncpg_stmt_N__' already exists".
    #   - statement_cache_size=0        -> disable asyncpg's own client-side cache
    #   - prepared_statement_cache_size=0 -> disable SQLAlchemy's asyncpg dialect cache
    #   - prepared_statement_name_func   -> unique name per prepare so nothing collides
    # All three are harmless on a direct/session connection, so apply them whenever
    # the async driver is asyncpg.
    if "+asyncpg" in dsn:
        return {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }
    return {}


def _build_engine(dsn: str):
    async_dsn = _as_async_dsn(dsn)
    return create_async_engine(
        async_dsn,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_pre_ping=True,
        echo=settings.db_echo,
        connect_args=_connect_args_for(async_dsn),
    )


# Privileged engine (schema owner) — for Alembic migrations and seed scripts.
migration_engine = _build_engine(str(settings.database_url))

# Runtime engine used by the API. When app_database_url is set it points at the
# least-privilege role so RLS is enforced; otherwise it's the same as
# migration_engine.
engine = (
    _build_engine(settings.app_database_url)
    if settings.app_database_url
    else migration_engine
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Row-Level Security (RLS) request context
# ---------------------------------------------------------------------------
# The RLS policies (migration 0005) filter rows via app_current_user_id(), which
# reads the `app.current_user_id` Postgres setting. Nothing set that value, so the
# whole RLS layer was inert. We now set it — transaction-scoped — on every
# transaction where a user context is known.
#
# IMPORTANT: RLS only takes effect when the app connects as a role WITHOUT the
# BYPASSRLS attribute (a Postgres superuser/owner still bypasses FORCE RLS is the
# exception — FORCE applies to the owner, but BYPASSRLS roles always skip it).
# Create a dedicated least-privilege application role for production; the default
# Supabase `postgres` superuser has BYPASSRLS and will skip all policies.
_current_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_user_id", default=None
)
# When true, the request may read/write rows across users (ADMIN / DERMATOLOGIST).
# Hooks into the pre-existing `{table}_service_bypass` RLS policies, which grant
# access when the `app.rls_bypass` setting is 'on'. USER-role requests never set
# this, so they are confined to their own rows by the `_user_isolation` policies.
_rls_bypass: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "rls_bypass", default=False
)


def set_rls_user_id(user_id: Optional[str | uuid.UUID]) -> None:
    """Bind the authenticated user id to the current request context for RLS."""
    _current_user_id.set(str(user_id) if user_id else None)


def set_rls_bypass(enabled: bool) -> None:
    """Allow the current request to bypass per-user RLS (admin/dermatologist)."""
    _rls_bypass.set(bool(enabled))


def _rls_statement() -> tuple[str, dict]:
    """SQL + params that publish the current RLS context as transaction-local settings."""
    uid = _current_user_id.get()
    bypass = "on" if _rls_bypass.get() else "off"
    return (
        "SELECT set_config('app.current_user_id', :uid, true), "
        "       set_config('app.rls_bypass', :bypass, true)",
        {"uid": uid or "", "bypass": bypass},
    )


@event.listens_for(Session, "after_begin")
def _apply_rls_context(session, transaction, connection):
    """
    On every transaction begin, publish the request's RLS context (user id + bypass
    flag) as transaction-local Postgres settings so RLS policies can filter rows.
    `set_config(..., is_local=true)` resets automatically at transaction end, so
    nothing leaks across pooled connections.
    """
    if _current_user_id.get() is None and not _rls_bypass.get():
        return  # no user context (e.g. login/register) — leave settings unset
    sql, params = _rls_statement()
    connection.execute(text(sql), params)


async def apply_rls_context(session: AsyncSession) -> None:
    """
    Re-publish the RLS context onto an already-open transaction.

    The auth dependency resolves the user's role only AFTER its first query has
    opened the transaction (so `after_begin` already fired without the bypass
    flag). Call this once the role is known to update the live transaction.
    """
    sql, params = _rls_statement()
    await session.execute(text(sql), params)


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
