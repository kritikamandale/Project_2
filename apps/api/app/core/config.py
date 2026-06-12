"""
Application configuration — reads all settings from environment variables.
Pydantic Settings validates types and raises on missing required values at startup.
"""

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # App
    # -------------------------------------------------------------------------
    app_name: str = "AI Skin Analysis API"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    secret_key: str = "change-me-dev"
    allowed_origins: list[str] = ["http://localhost:3000"]
    frontend_url: str = "http://localhost:3000"
    trusted_hosts: list[str] = ["localhost", "127.0.0.1"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
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
    jwt_secret_key: str = "change-me-in-production"   # HS256 dev fallback
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

    # -------------------------------------------------------------------------
    # Database (PostgreSQL 15)
    # -------------------------------------------------------------------------
    database_url: PostgresDsn

    # Connection pool settings
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # -------------------------------------------------------------------------
    # Redis 7
    # -------------------------------------------------------------------------
    redis_url: RedisDsn
    session_ttl: int = 3600       # seconds
    cache_ttl: int = 300          # seconds

    # -------------------------------------------------------------------------
    # AWS S3 (ephemeral image storage)
    # -------------------------------------------------------------------------
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "ap-south-1"
    s3_bucket_name: str
    s3_presigned_url_expiry: int = 60   # seconds — images auto-deleted
    s3_lifecycle_expiry_days: int = 1

    # -------------------------------------------------------------------------
    # Anthropic / Claude (recommendation engine)
    # -------------------------------------------------------------------------
    anthropic_api_key: str
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 4096

    # -------------------------------------------------------------------------
    # Pinecone (product vector embeddings)
    # -------------------------------------------------------------------------
    pinecone_api_key: str
    pinecone_environment: str
    pinecone_index_name: str = "skin-products"

    # -------------------------------------------------------------------------
    # Sentry
    # -------------------------------------------------------------------------
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1

    # -------------------------------------------------------------------------
    # Email (SendGrid)
    # -------------------------------------------------------------------------
    smtp_host: str = "smtp.sendgrid.net"
    smtp_port: int = 587
    smtp_user: str = "apikey"
    smtp_password: str = ""
    email_from: str = "noreply@yourdomain.com"
    email_from_name: str = "SkinAI"

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


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — imported throughout the app."""
    return Settings()


settings = get_settings()
