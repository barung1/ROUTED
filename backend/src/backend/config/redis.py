"""
Redis Client Singleton for Routed.

Used for Celery broker and graph score caching.
Returns None gracefully if Redis is unavailable.
"""

import os
from typing import Optional

_redis_client = None
_client_initialized = False


def get_redis_client():
    """
    Return a Redis client instance, or None if unavailable.

    Uses lazy initialization. If Redis is unreachable, returns None
    so callers can degrade gracefully (e.g. skip caching).
    """
    global _redis_client, _client_initialized

    if _client_initialized:
        return _redis_client

    _client_initialized = True
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        from backend.loggers.logger import logger
        logger.info("[Redis] Connected at %s", redis_url.split("@")[-1] if "@" in redis_url else redis_url)
    except Exception as exc:
        from backend.loggers.logger import logger
        logger.warning("[Redis] Unavailable — caching disabled. (%s)", exc)
        _redis_client = None

    return _redis_client
