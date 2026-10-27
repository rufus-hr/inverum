import valkey
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    client = valkey.Valkey.from_url(settings.VALKEY_URL, decode_responses=True)
    client.ping()
    logger.info("Valkey connected")
except Exception as e:
    logger.warning(f"Valkey unavailable: {e}")
    client = None


def get_valkey():
    """Return the active Valkey client instance (or reconnect if needed)."""
    global client
    if client is not None:
        return client
    try:
        client = valkey.Valkey.from_url(settings.VALKEY_URL, decode_responses=True)
        client.ping()
        return client
    except Exception:
        return None