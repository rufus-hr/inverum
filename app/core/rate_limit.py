"""
Rate limiting via slowapi + Valkey sliding window.
Import `limiter` and apply @limiter.limit("X/minute") on routes.
Register the limiter and exception handler in main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.VALKEY_URL,
    default_limits=["1000/minute"],
)
