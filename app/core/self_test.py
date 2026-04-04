import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_INTERVAL = 30   # seconds between checks
_STALE_TTL = 60  # seconds before result is considered stale


def _checks_sync() -> dict[str, bool]:
    """Synchronous checks — run in executor so we don't block event loop."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    from app.core.config import settings

    results: dict[str, bool] = {}

    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            results["database"] = True
        finally:
            db.close()
    except Exception as e:
        logger.warning("self-test db failed: %s", e)
        results["database"] = False

    try:
        import redis
        r = redis.from_url(settings.VALKEY_URL, socket_connect_timeout=2, socket_timeout=2)
        r.ping()
        r.close()
        results["valkey"] = True
    except Exception as e:
        logger.warning("self-test valkey failed: %s", e)
        results["valkey"] = False

    return results


async def self_test_loop(app) -> None:
    """Background task: run checks every _INTERVAL seconds, store result in app.state."""
    while True:
        try:
            loop = asyncio.get_event_loop()
            checks = await loop.run_in_executor(None, _checks_sync)
            app.state.self_test = {
                "healthy": all(checks.values()),
                "checked_at": datetime.now(timezone.utc),
                "checks": checks,
            }
        except Exception:
            logger.exception("self-test loop error")
        await asyncio.sleep(_INTERVAL)


def get_liveness(app) -> tuple[bool, dict]:
    """
    Returns (is_healthy, detail).
    Unhealthy if: no result yet, result is stale, or any check failed.
    """
    state = getattr(app.state, "self_test", None)
    if state is None:
        return False, {"status": "starting", "detail": "self-test not yet run"}

    age = (datetime.now(timezone.utc) - state["checked_at"]).total_seconds()
    if age > _STALE_TTL:
        return False, {"status": "stale", "age_seconds": int(age), "checks": state["checks"]}

    if not state["healthy"]:
        return False, {"status": "unhealthy", "checks": state["checks"]}

    return True, {"status": "ok", "checks": state["checks"]}
