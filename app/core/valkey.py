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