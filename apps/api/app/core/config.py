"""
Application configuration — reads all settings from environment variables.
Pydantic Settings validates types and raises on missing required values at startup.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_WEAK_SECRETS = frozenset({
    "change-me-dev", "change-me-in-production", "secret", "dev-secret",
    "changeme", "your-secret-key", "supersecret",
})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,  # treat VAR= as unset (use field default)
        str_strip_whitespace=True,  # trim stray spaces/newlines in env values
                                    # (e.g. "GROQ_API_KEY= gsk_..." would otherwise
                                    # send a malformed "Bearer  <key>" header)
    )

    # -------------------------------------------------------------------------
    # App
    # -------------------------------------------------------------------------
    app_name: str = "AI Skin Analysis API"
    app_version: str = "0.1.0"
    # ENVIRONMENT must be set explicitly — defaults to "development" so local
    # dev works without extra config, but production deployments must set it.
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    secret_key: str = Field(
        "dev_secret_key_32_characters_minimum_length_required!", min_length=32
    )
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3100",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3100",
        "http://127.0.0.1:3001",
        "https://skiinest.vercel.app",
    ]
    frontend_url: str = "https://skiinest.vercel.app"
    trusted_hosts: list[str] = ["*"]

    # Only trust X-Forwarded-For / X-Forwarded-Proto when the API actually sits
    # behind a trusted reverse proxy (the Next.js proxy / a load balancer that
    # rewrites the header). If the API is ever directly reachable, a client can
    # forge X-Forwarded-For to spoof its IP for rate-limiting and audit logs, so
    # this MUST be false in that case.
    trust_proxy_headers: bool = True

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                import json
                try:
                    res = json.loads(v_str)
                    if isinstance(res, list):
                        return [str(o).strip(' "\'[]') for o in res if str(o).strip(' "\'[]')]
                except Exception:  # noqa: S110
                    pass
            return [origin.strip(' "\'[]') for origin in v_str.split(",") if origin.strip(' "\'[]')]
        elif isinstance(v, list):
            return [str(o).strip(' "\'[]') for o in v if str(o).strip(' "\'[]')]
        return v

    @field_validator("trusted_hosts", mode="before")
    @classmethod
    def parse_trusted_hosts(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [h.strip() for h in v.split(",")]
        return v

    # -------------------------------------------------------------------------
    # JWT — RS256 in production, HS256 in development
    # Set jwt_private_key / jwt_public_key (PEM, \n-escaped) to enable RS256.
    # -------------------------------------------------------------------------
    jwt_secret_key: str = Field(
        "dev_jwt_secret_key_32_characters_minimum_length_required!", min_length=32
    )
    jwt_private_key: str = ""   # RSA private key PEM (production)
    jwt_public_key: str = ""    # RSA public key PEM (production)
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # -------------------------------------------------------------------------
    # Auth security — login attempts, OTP, lockout
    # -------------------------------------------------------------------------
    login_max_attempts: int = 5
    login_lockout_minutes: int = 30
    otp_expire_minutes: int = 10
    otp_max_attempts: int = 3
    password_reset_expire_minutes: int = 15
    # Rate limiting (slowapi) — requests per window
    rate_limit_general: str = "100/minute"  # public API endpoints
    rate_limit_auth: str = "5/hour"         # register / forgot-password
    rate_limit_login: str = "10/minute"     # login endpoint

    # File upload security
    file_upload_max_size_bytes: int = 5_242_880   # 5 MB
    file_upload_allowed_mime_types: list[str] = [
        "image/jpeg", "image/png", "image/webp", "application/pdf"
    ]

    # ClamAV malware scanning sidecar
    clamav_host: str = "clamav"
    clamav_port: int = 3310
    clamav_enabled: bool = False  # enabled in production via env

    @field_validator("file_upload_allowed_mime_types", mode="before")
    @classmethod
    def parse_mime_types(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [m.strip() for m in v.split(",")]
        return v

    # Admin IP allowlist (comma-separated) — only these IPs can reach
    # /api/v1/admin/*. Empty = allow all (the documented dev default).
    # Enforced in app.core.dependencies.enforce_admin_ip_allowlist.
    admin_ip_allowlist: list[str] = []

    @field_validator("admin_ip_allowlist", mode="before")
    @classmethod
    def parse_admin_ip_allowlist(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [ip.strip() for ip in v.split(",") if ip.strip()]
        return v

    # -------------------------------------------------------------------------
    # Database (PostgreSQL 15)
    # -------------------------------------------------------------------------
    # Privileged connection — owns the schema. Used by Alembic migrations and
    # seed scripts (DDL + RLS-bypass). Keep this as the postgres/owner role.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/skin_analysis"

    # Least-privilege runtime connection (optional). When set, the running API
    # uses THIS instead of database_url, so RLS policies are actually enforced
    # (the role must NOT have BYPASSRLS). Leave blank to run everything on
    # database_url (RLS then relies on the role not having BYPASSRLS).
    app_database_url: str = ""

    # Connection pool settings
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # Log every SQL statement (set DB_ECHO=true when debugging queries).
    # Deliberately decoupled from DEBUG — echo adds real per-request overhead.
    db_echo: bool = False

    # Create missing tables on startup in dev. Schema is managed by Alembic
    # (alembic upgrade head); this is only a convenience for fresh clones.
    db_auto_create: bool = True

    # -------------------------------------------------------------------------
    # Redis 7
    # -------------------------------------------------------------------------
    redis_url: str = "redis://localhost:6379/0"
    session_ttl: int = 3600       # seconds
    cache_ttl: int = 300          # seconds

    # -------------------------------------------------------------------------
    # AWS S3 (ephemeral image storage)
    # -------------------------------------------------------------------------
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    s3_bucket_name: str = "skin-analysis-ephemeral"
    s3_presigned_url_expiry: int = 60   # seconds — images auto-deleted
    s3_lifecycle_expiry_days: int = 1

    # -------------------------------------------------------------------------
    # Groq (recommendation engine — free tier: 14,400 req/day)
    # Get a free key at https://console.groq.com/keys
    # -------------------------------------------------------------------------
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_max_tokens: int = 4096

    # -------------------------------------------------------------------------
    # Pinecone (product vector embeddings — optional)
    # Leave blank to use the built-in PostgreSQL / pgvector fallback.
    # -------------------------------------------------------------------------
    pinecone_api_key: str = ""
    pinecone_environment: str = ""
    pinecone_index_name: str = "skin-products"

    # -------------------------------------------------------------------------
    # Sentry
    # -------------------------------------------------------------------------
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1

    # -------------------------------------------------------------------------
    # Email — Brevo HTTP API (recommended for Railway) or SMTP or Resend
    # Brevo free tier: 300 emails/day to ANY address, no domain needed.
    # Sign up at https://app.brevo.com and copy your SMTP & API Keys -> API Keys
    # -------------------------------------------------------------------------
    brevo_api_key: str = ""

    # Resend or SMTP (fallback — SMTP is blocked by Railway)
    resend_api_key: str = ""
    email_from: str = "onboarding@resend.dev"
    email_from_name: str = "Skinest"

    # SMTP configuration (works locally, NOT on Railway)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True

    # -------------------------------------------------------------------------
    # Climate API (OpenWeatherMap — India-specific skin factors)
    # -------------------------------------------------------------------------
    openweather_api_key: str = ""
    climate_cache_ttl: int = 3600

    # -------------------------------------------------------------------------
    # Feature flags
    # -------------------------------------------------------------------------
    enable_dermatologist_review: bool = True
    enable_waitlist: bool = False
    enable_analytics: bool = True
    max_scans_per_user_per_day: int = 3

    # -------------------------------------------------------------------------
    # Computed helpers
    # -------------------------------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_prod_like(self) -> bool:
        """Production or staging — hardening that should never be dev-only."""
        return self.environment in ("production", "staging")

    @model_validator(mode="after")
    def _enforce_strong_secrets_in_production(self) -> "Settings":
        if self.environment in ("production", "staging"):
            if self.secret_key in _WEAK_SECRETS:
                raise ValueError(
                    "SECRET_KEY must be a strong random value in production/staging. "
                    "Generate one with: openssl rand -hex 32"
                )
            if self.jwt_secret_key in _WEAK_SECRETS:
                raise ValueError(
                    "JWT_SECRET_KEY must be a strong random value in production/staging. "
                    "Generate one with: openssl rand -hex 32"
                )
            if not self.clamav_enabled:
                raise ValueError(
                    "CLAMAV_ENABLED must be true in production/staging — file uploads "
                    "would otherwise be treated as clean without ever being scanned."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — imported throughout the app."""
    return Settings()


settings = get_settings()
