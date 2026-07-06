"""
FastAPI application entry point.
"""

import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import (
    admin,
    auth,
    users,
    scan,
    questionnaire,
    recommendations,
    products,
    progress,
    dermatologist,
    privacy,
    onboarding,
)

# ---------------------------------------------------------------------------
# Sentry
# ---------------------------------------------------------------------------
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.environment,
        release=settings.app_version,
    )

# ---------------------------------------------------------------------------
# slowapi rate limiter (shared instance — routers import from app.core.limiter)
# ---------------------------------------------------------------------------
from app.core.limiter import limiter


# ---------------------------------------------------------------------------
# Security headers middleware (Helmet-equivalent)
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_development and settings.db_auto_create:
        try:
            async with engine.begin() as conn:
                # One cheap existence probe instead of letting create_all
                # round-trip once per table/enum on every dev reload — with a
                # remote database that used to add ~20s per restart.
                from sqlalchemy import inspect as sa_inspect
                has_users = await conn.run_sync(
                    lambda sync_conn: sa_inspect(sync_conn).has_table("users")
                )
                if not has_users:
                    await conn.run_sync(Base.metadata.create_all)
        except Exception as exc:
            # Allow server to start without a database in local dev (useful for UI dev)
            import logging
            logging.getLogger("uvicorn.error").warning(
                "Database unavailable on startup (dev mode) — %s. "
                "API endpoints requiring DB will fail until PostgreSQL is running.", exc
            )
    yield
    await engine.dispose()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# Attach limiter to app state so routers can access it via request.app.state.limiter
app.state.limiter = limiter

# ---------------------------------------------------------------------------
# Middleware (order matters — outermost added last)
# ---------------------------------------------------------------------------
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "Accept"],
    expose_headers=["X-Request-ID"],
)

if settings.is_prod_like:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.trusted_hosts,
    )

# Rate limit exceeded → 429 JSON response
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
API_PREFIX = "/api/v1"

app.include_router(auth.router,            prefix=f"{API_PREFIX}/auth",            tags=["auth"])
app.include_router(users.router,           prefix=f"{API_PREFIX}/users",           tags=["users"])
app.include_router(scan.router,            prefix=f"{API_PREFIX}/scan",            tags=["scan"])
app.include_router(questionnaire.router,   prefix=f"{API_PREFIX}/questionnaire",   tags=["questionnaire"])
app.include_router(onboarding.router,      prefix=f"{API_PREFIX}/onboarding",      tags=["onboarding"])
app.include_router(recommendations.router, prefix=f"{API_PREFIX}/recommendations", tags=["recommendations"])
app.include_router(products.router,        prefix=f"{API_PREFIX}/products",        tags=["products"])
app.include_router(progress.router,        prefix=f"{API_PREFIX}/progress",        tags=["progress"])
app.include_router(dermatologist.router,   prefix=f"{API_PREFIX}/dermatologist",   tags=["dermatologist"])
app.include_router(admin.router,           prefix=f"{API_PREFIX}/admin",           tags=["admin"])
app.include_router(privacy.router,         prefix=f"{API_PREFIX}/users",           tags=["privacy"])

import sys
import traceback


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"GLOBAL EXCEPTION: {exc}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    if settings.is_prod_like:
        content = {"detail": "Internal server error"}
    else:
        content = {"detail": str(exc), "traceback": traceback.format_exc()}
    return JSONResponse(status_code=500, content=content)

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": settings.app_version, "env": settings.environment}
