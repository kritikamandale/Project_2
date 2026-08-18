"""
FastAPI application entry point.
"""

import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import engine, migration_engine, Base
from app.core.dependencies import enforce_admin_ip_allowlist
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
            # DDL requires the privileged (schema-owner) engine, not the
            # least-privilege runtime engine.
            async with migration_engine.begin() as conn:
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
    if migration_engine is not engine:
        await migration_engine.dispose()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    # Hide interactive docs + the OpenAPI schema in every prod-like environment
    # (production AND staging). Staging previously leaked /docs and the full
    # /openapi.json to anyone.
    docs_url="/docs" if not settings.is_prod_like else None,
    redoc_url="/redoc" if not settings.is_prod_like else None,
    openapi_url="/openapi.json" if not settings.is_prod_like else None,
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
    allow_origin_regex=r"https://.*\.vercel\.app",
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
app.include_router(admin.router,           prefix=f"{API_PREFIX}/admin",           tags=["admin"], dependencies=[Depends(enforce_admin_ip_allowlist)])
app.include_router(privacy.router,         prefix=f"{API_PREFIX}/users",           tags=["privacy"])

import logging
import traceback

_logger = logging.getLogger("app.error")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log through the logging framework (captured by Sentry / log aggregation),
    # not raw stdout/stderr prints.
    _logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    if settings.is_prod_like:
        # Never leak internals (messages, stack traces) to clients in prod/staging.
        content = {"detail": "Internal server error"}
    else:
        content = {"detail": str(exc), "traceback": traceback.format_exc()}
    return JSONResponse(status_code=500, content=content)

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": settings.app_version, "env": settings.environment}


@app.get("/test-email", tags=["health"])
async def test_email(to: str = ""):
    """
    Diagnostic endpoint — tests your email configuration live.
    Usage: GET /test-email?to=youremail@gmail.com
    Tests Brevo first (works on Railway), then SMTP.
    """
    if not to or "@" not in to:
        return {
            "error": "Please pass ?to=youremail@example.com in the URL",
            "brevo_api_key_set": bool(settings.brevo_api_key),
            "smtp_host": settings.smtp_host or "(not set)",
            "smtp_port": settings.smtp_port,
            "smtp_user": settings.smtp_user or "(not set)",
            "email_from": settings.email_from,
        }

    config_info = {
        "brevo_api_key_set": bool(settings.brevo_api_key),
        "smtp_host": settings.smtp_host or "(not set)",
        "smtp_port": settings.smtp_port,
        "smtp_user": settings.smtp_user or "(not set)",
        "smtp_password_length": len(settings.smtp_password.replace(" ", "")),
        "email_from": settings.email_from,
        "sending_to": to,
    }

    # ---- Test Brevo first (HTTP API — not blocked by Railway) ----
    if settings.brevo_api_key:
        import httpx
        payload = {
            "sender": {"name": settings.email_from_name, "email": settings.email_from},
            "to": [{"email": to}],
            "subject": "Skinest Email Test (Brevo)",
            "textContent": "This is a test email from your Skinest backend via Brevo. It is working correctly!",
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    json=payload,
                    headers={"api-key": settings.brevo_api_key, "Content-Type": "application/json"},
                )
            if resp.status_code in (200, 201):
                return {"result": "SUCCESS via Brevo! Check your inbox (and spam).", "brevo_response": resp.json(), **config_info}
            return {"result": "FAIL — Brevo API error", "status_code": resp.status_code, "brevo_error": resp.text, **config_info}
        except Exception as e:
            return {"result": f"FAIL — Brevo exception: {type(e).__name__}", "error": str(e), **config_info}

    # ---- SMTP fallback ----
    import smtplib
    smtp_host = settings.smtp_host.strip() if settings.smtp_host else ""
    if not smtp_host:
        return {"result": "SKIP — Neither BREVO_API_KEY nor SMTP_HOST is set in Railway", **config_info}

    smtp_user = (settings.smtp_user or settings.email_from).strip()
    smtp_pass = settings.smtp_password.replace(" ", "").strip()
    port = settings.smtp_port or 587
    try:
        if port == 465:
            with smtplib.SMTP_SSL(smtp_host, port, timeout=12) as server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to], "Subject: Skinest SMTP Test\n\nSMTP is working!")
        else:
            with smtplib.SMTP(smtp_host, port, timeout=12) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to], "Subject: Skinest SMTP Test\n\nSMTP is working!")
        return {"result": "SUCCESS via SMTP! Check your inbox (and spam).", **config_info}
    except Exception as e:
        return {"result": f"FAIL — {type(e).__name__} (Railway blocks SMTP — set BREVO_API_KEY instead)", "error": str(e), **config_info}
