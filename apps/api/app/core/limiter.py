"""
Shared slowapi rate-limiter instance.
Import this in routers to apply @limiter.limit() decorators,
and in main.py to attach the middleware and exception handler.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
