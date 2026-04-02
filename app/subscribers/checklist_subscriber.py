"""
SOP Checklist subscriber.

Listens to asset lifecycle events and triggers checklist completions.
Maps Event Bus event_type strings to checklist trigger constants.
"""

import uuid
import logging

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.event_bus import EventBus
from app.services import checklist_service
from app.services.event_bus_service import subscribe

logger = logging.getLogger(__name__)

# Event Bus event_type → checklist trigger constant
_EVENT_TO_TRIGGER: dict[str, str] = {
    "asset_import_to_stock":   checklist_service.TRIGGER_IMPORT_TO_STOCK,
    "asset_assigned":          checklist_service.TRIGGER_STOCK_TO_ASSIGNED,
    "asset_reassigned":        checklist_service.TRIGGER_ASSIGNED_TO_USER,
    "asset_returned":          checklist_service.TRIGGER_ASSIGNED_TO_STOCK,
    "asset_to_service":        checklist_service.TRIGGER_TO_SERVICE,
    "asset_from_service":      checklist_service.TRIGGER_FROM_SERVICE,
    "asset_retired":           checklist_service.TRIGGER_RETIRE,
}


@subscribe
def handle_asset_event(db: Session, event: EventBus) -> None:
    trigger = _EVENT_TO_TRIGGER.get(event.event_type)
    if not trigger:
        return  # not a checklist-relevant event

    if event.entity_type != "asset":
        return

    asset = db.get(Asset, event.entity_id)
    if not asset or asset.deleted_at is not None:
        logger.warning("checklist_subscriber: asset %s not found", event.entity_id)
        return

    pending_transition = event.payload.get("pending_transition", {})
    triggered_by_user_id = event.payload.get("triggered_by_user_id")
    if triggered_by_user_id:
        triggered_by_user_id = uuid.UUID(triggered_by_user_id)

    completions = checklist_service.trigger_event(
        db=db,
        event=trigger,
        asset=asset,
        pending_transition=pending_transition,
        triggered_by_user_id=triggered_by_user_id,
    )

    if completions:
        logger.info(
            "checklist_subscriber: created %d completion(s) for asset %s event %s",
            len(completions), asset.id, event.event_type,
        )
