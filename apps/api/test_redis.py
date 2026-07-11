import asyncio
import sys
import os

sys.path.append(os.path.abspath("."))
import redis.asyncio as aioredis
from app.core.config import settings

async def test():
    print(f"Redis URL: {settings.redis_url}")
    try:
        r = aioredis.from_url(str(settings.redis_url), socket_timeout=3)
        await r.ping()
        print('Redis OK')
        await r.aclose()
    except Exception as e:
        print(f"Redis Error: {e}")

asyncio.run(test())
