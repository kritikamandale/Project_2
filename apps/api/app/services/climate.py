"""
Climate service — fetches AQI, UV index, and humidity for Indian cities.
Results cached in Redis to avoid redundant API calls.
"""

import json

import redis.asyncio as aioredis

from app.core.config import settings


class ClimateService:
    def __init__(self, redis: aioredis.Redis):
        self._redis = redis

    async def get_climate_data(self, city: str) -> dict:
        """
        Returns current weather + AQI for city.
        Cache key: climate:{city_slug}  TTL: CLIMATE_CACHE_TTL seconds.
        TODO: implement OpenWeatherMap fetch + AQI API call
        """
        cache_key = f"climate:{city.lower().replace(' ', '_')}"
        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        data = await self._fetch_from_api(city)

        await self._redis.setex(cache_key, settings.climate_cache_ttl, json.dumps(data))
        return data

    async def _fetch_from_api(self, city: str) -> dict:
        """
        Calls OpenWeatherMap current weather + air pollution endpoints.
        TODO: implement
        """
        raise NotImplementedError
