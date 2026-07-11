"""
Shared slowapi rate-limiter instance.
Import this in routers to apply @limiter.limit() decorators,
and in main.py to attach the middleware and exception handler.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Was hardcoded to "200/minute" here, silently ignoring settings.rate_limit_general
# ("100/minute") — the two had drifted apart. Read from settings so the env var
# is actually meaningful and docs/code agree.
#
# Storage: use Redis so counters are SHARED across every Uvicorn worker and every
# app instance. The previous default (in-memory) tracked limits per-process, so
# with >1 worker the effective limit was N× the configured value and reset on each
# reload — i.e. rate limiting was ineffective at any real scale.
#
# in_memory_fallback_enabled keeps local dev working when Redis isn't running
# (mirrors the _FakeRedis fallback used elsewhere in dev).
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.rate_limit_general],
    storage_uri=str(settings.redis_url),
    in_memory_fallback_enabled=True,
)
