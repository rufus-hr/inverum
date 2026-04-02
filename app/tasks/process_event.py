"""
Event Bus processor Celery task.
Queue: inverum-worker-default
"""

import uuid
import logging

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.event_bus import EventBus

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.process_event.process_event",
    queue="inverum-worker-default",
    max_retries=5,
    default_retry_delay=30,
    acks_late=True,
)
def process_event(self, event_id: str) -> None:
    # Import subscribers so they register themselves before process() runs
    import app.subscribers  # noqa: F401

    from app.services.event_bus_service import process

    db = SessionLocal()
    try:
        event = db.get(EventBus, uuid.UUID(event_id))
        if not event:
            logger.warning("EventBus %s not found", event_id)
            return

        if event.processed_at is not None:
            return  # already processed (duplicate delivery)

        process(db, event)
        db.commit()

    except Exception as exc:
        db.rollback()
        logger.exception("process_event failed for %s", event_id)
        raise self.retry(exc=exc)
    finally:
        db.close()
