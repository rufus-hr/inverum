"""
Event Bus service.

publish() — persists event to DB, queues Celery task.
Subscribers registered via @subscribe decorator.
process() — called by Celery task, dispatches to all matching subscribers.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy.orm import Session

from app.models.event_bus import EventBus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Subscriber registry
# ---------------------------------------------------------------------------

_subscribers: list[Callable] = []


def subscribe(fn: Callable) -> Callable:
    """Decorator — register a subscriber function."""
    _subscribers.append(fn)
    return fn


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

def publish(
    db: Session,
    tenant_id: uuid.UUID,
    event_type: str,
    entity_type: str,
    entity_id: uuid.UUID,
    payload: dict,
) -> EventBus:
    """
    Persist event to DB and queue Celery processing task.
    Call before db.commit() so event is part of the same transaction.
    """
    event = EventBus(
        tenant_id=tenant_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(event)
    db.flush()  # get event.id before commit

    # Import here to avoid circular imports at module load time
    from app.tasks.process_event import process_event
    # delay() is called after flush — event exists in DB, task will find it
    process_event.apply_async(
        args=[str(event.id)],
        countdown=0,
    )

    return event


# ---------------------------------------------------------------------------
# Process — called by Celery task
# ---------------------------------------------------------------------------

def process(db: Session, event: EventBus) -> None:
    """
    Dispatch event to all registered subscribers.
    Marks event as processed or records error.
    """
    errors = []

    for subscriber in _subscribers:
        try:
            subscriber(db, event)
        except Exception as e:
            logger.exception(
                "Subscriber %s failed for event %s", subscriber.__name__, event.id
            )
            errors.append(f"{subscriber.__name__}: {e}")

    if errors:
        event.error_message = " | ".join(errors)
        event.retry_count += 1
    else:
        event.processed_at = datetime.now(timezone.utc)
        event.error_message = None
