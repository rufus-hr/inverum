"""
SOP Checklist service.

Trigger logic: when an asset transition is requested, call trigger_event().
If no active template matches → returns None (no block).
If templates match → creates ChecklistCompletion(s) and sets asset.is_checklist_pending = True.

pending_transition is duplicated across all completions for the same event intentionally —
keeps each completion self-contained for audit purposes. The transition is executed
only when all completions for the asset+event are in status submitted or confirmed.
"""

import uuid
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.checklist_template import ChecklistTemplate
from app.models.checklist_completion import ChecklistCompletion
from app.models.checklist_item import ChecklistItem
from app.models.checklist_item_completion import ChecklistItemCompletion

logger = logging.getLogger(__name__)

# Standard trigger event constants — tenants can also use custom strings
TRIGGER_IMPORT_TO_STOCK   = "asset_import_to_stock"
TRIGGER_STOCK_TO_ASSIGNED = "asset_stock_to_assigned"
TRIGGER_ASSIGNED_TO_STOCK = "asset_assigned_to_stock"
TRIGGER_ASSIGNED_TO_USER  = "asset_reassigned"
TRIGGER_TO_SERVICE        = "asset_to_service"
TRIGGER_FROM_SERVICE      = "asset_from_service"
TRIGGER_RETIRE            = "asset_retired"


def trigger_event(
    db: Session,
    event: str,
    asset: Asset,
    pending_transition: dict,
    triggered_by_user_id: uuid.UUID | None,
) -> list[ChecklistCompletion]:
    """
    Find active templates for this event + asset category.
    Apply frequency logic per template.
    Create ChecklistCompletion for each matching template.
    Set asset.is_checklist_pending = True if any created.
    Returns list of created completions (empty = no block, proceed immediately).
    """
    templates = (
        db.query(ChecklistTemplate)
        .filter(
            ChecklistTemplate.tenant_id == asset.tenant_id,
            ChecklistTemplate.trigger_event == event,
            ChecklistTemplate.is_active == True,
            ChecklistTemplate.deleted_at == None,
        )
        .all()
    )

    # Filter by asset_category (NULL = matches all)
    asset_category = getattr(asset, "category", None)
    templates = [
        t for t in templates
        if t.asset_category is None or t.asset_category == asset_category
    ]

    created = []
    for template in templates:
        if not _should_create(db, template, triggered_by_user_id):
            continue

        completion = ChecklistCompletion(
            tenant_id=asset.tenant_id,
            organization_id=asset.organization_id,
            template_id=template.id,
            asset_id=asset.id,
            status="open",
            triggered_by=event,
            triggered_by_user_id=triggered_by_user_id,
            pending_transition=pending_transition,
        )
        db.add(completion)
        created.append(completion)

    if created:
        asset.is_checklist_pending = True

    return created


def _should_create(
    db: Session,
    template: ChecklistTemplate,
    triggered_by_user_id: uuid.UUID | None,
) -> bool:
    """Apply frequency logic to decide whether to create a new completion."""
    if template.frequency == "per_event":
        return True

    if triggered_by_user_id is None:
        return True

    q = db.query(ChecklistCompletion).filter(
        ChecklistCompletion.template_id == template.id,
        ChecklistCompletion.triggered_by_user_id == triggered_by_user_id,
        ChecklistCompletion.status.in_(["submitted", "confirmed"]),
        ChecklistCompletion.deleted_at == None,
    )

    if template.frequency == "per_employee_yearly":
        cutoff = datetime.now(timezone.utc) - timedelta(days=365)
        q = q.filter(ChecklistCompletion.submitted_at >= cutoff)

    return not db.query(q.exists()).scalar()


def check_item(
    db: Session,
    completion: ChecklistCompletion,
    item: ChecklistItem,
    checked_by: uuid.UUID,
    note: str | None,
) -> ChecklistItemCompletion:
    """Check a single item. Creates or updates ChecklistItemCompletion."""
    if item.depends_on_item_id:
        parent = (
            db.query(ChecklistItemCompletion)
            .filter(
                ChecklistItemCompletion.completion_id == completion.id,
                ChecklistItemCompletion.item_id == item.depends_on_item_id,
                ChecklistItemCompletion.checked == True,
            )
            .first()
        )
        if not parent:
            raise ValueError(f"Depends-on item must be checked first")

    if item.requires_note and not note:
        raise ValueError(f"Note is required for this item")

    existing = (
        db.query(ChecklistItemCompletion)
        .filter(
            ChecklistItemCompletion.completion_id == completion.id,
            ChecklistItemCompletion.item_id == item.id,
        )
        .first()
    )
    if existing:
        existing.checked = True
        existing.note = note
        existing.checked_at = datetime.now(timezone.utc)
        existing.checked_by = checked_by
        return existing

    item_completion = ChecklistItemCompletion(
        completion_id=completion.id,
        item_id=item.id,
        checked=True,
        note=note,
        checked_at=datetime.now(timezone.utc),
        checked_by=checked_by,
    )
    db.add(item_completion)
    return item_completion


def uncheck_item(
    db: Session,
    completion: ChecklistCompletion,
    item_id: uuid.UUID,
) -> None:
    """Uncheck an item. Also unchecks any items that depend on this one."""
    item_completion = (
        db.query(ChecklistItemCompletion)
        .filter(
            ChecklistItemCompletion.completion_id == completion.id,
            ChecklistItemCompletion.item_id == item_id,
        )
        .first()
    )
    if item_completion:
        item_completion.checked = False
        item_completion.checked_at = None
        item_completion.checked_by = None

    # Cascade uncheck to dependent items
    dependents = (
        db.query(ChecklistItem)
        .filter(
            ChecklistItem.template_id == completion.template_id,
            ChecklistItem.depends_on_item_id == item_id,
            ChecklistItem.deleted_at == None,
        )
        .all()
    )
    for dep in dependents:
        uncheck_item(db, completion, dep.id)


def submit_completion(
    db: Session,
    completion: ChecklistCompletion,
    submitted_by: uuid.UUID,
) -> bool:
    """
    Submit a completion. Returns True if all completions for this asset+event
    are now closed and pending_transition should be executed.
    """
    blocking_items = (
        db.query(ChecklistItem)
        .filter(
            ChecklistItem.template_id == completion.template_id,
            ChecklistItem.is_blocking == True,
            ChecklistItem.is_active == True,
            ChecklistItem.deleted_at == None,
        )
        .all()
    )
    checked_ids = {
        ic.item_id
        for ic in db.query(ChecklistItemCompletion).filter(
            ChecklistItemCompletion.completion_id == completion.id,
            ChecklistItemCompletion.checked == True,
        ).all()
    }
    unchecked = [item for item in blocking_items if item.id not in checked_ids]
    if unchecked:
        raise ValueError(f"Blocking items not completed: {[str(i.id) for i in unchecked]}")

    completion.status = "submitted"
    completion.submitted_by = submitted_by
    completion.submitted_at = datetime.now(timezone.utc)
    completion.all_checked = True

    template = db.get(ChecklistTemplate, completion.template_id)
    if template and template.requires_confirmation:
        return False  # Wait for confirm step

    return _check_all_closed(db, completion)


def confirm_completion(
    db: Session,
    completion: ChecklistCompletion,
    confirmed_by: uuid.UUID,
) -> bool:
    """
    4-eyes confirm. confirmed_by must differ from submitted_by.
    Returns True if all completions are closed and transition should execute.
    """
    if completion.submitted_by == confirmed_by:
        raise ValueError("Confirmed by must differ from submitted by (4-eyes rule)")

    completion.status = "confirmed"
    completion.confirmed_by = confirmed_by
    completion.confirmed_at = datetime.now(timezone.utc)

    return _check_all_closed(db, completion)


def cancel_completion(
    db: Session,
    completion: ChecklistCompletion,
    asset: Asset,
) -> None:
    """Cancel a completion. Clears is_checklist_pending if no other open completions remain."""
    completion.status = "cancelled"
    completion.deleted_at = datetime.now(timezone.utc)

    still_open = (
        db.query(ChecklistCompletion)
        .filter(
            ChecklistCompletion.asset_id == asset.id,
            ChecklistCompletion.triggered_by == completion.triggered_by,
            ChecklistCompletion.status == "open",
            ChecklistCompletion.id != completion.id,
            ChecklistCompletion.deleted_at == None,
        )
        .first()
    )
    if not still_open:
        asset.is_checklist_pending = False


def _check_all_closed(db: Session, completion: ChecklistCompletion) -> bool:
    """
    Check if all completions for this asset + trigger event are submitted or confirmed.
    If yes, caller should execute pending_transition and clear is_checklist_pending.
    """
    open_siblings = (
        db.query(ChecklistCompletion)
        .filter(
            ChecklistCompletion.asset_id == completion.asset_id,
            ChecklistCompletion.triggered_by == completion.triggered_by,
            ChecklistCompletion.status == "open",
            ChecklistCompletion.id != completion.id,
            ChecklistCompletion.deleted_at == None,
        )
        .first()
    )
    return open_siblings is None
