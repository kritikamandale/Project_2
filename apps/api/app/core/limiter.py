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
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_general])
