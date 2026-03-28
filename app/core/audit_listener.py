"""
SQLAlchemy event listener for data audit and revert logging.

Design:
- before_flush: capture old values using attribute history (while history is still intact)
- after_flush: write DataAuditLog and SqlRevertLog records

Old values are captured in before_flush because SQLAlchemy resets attribute history
after each flush. By after_flush, history has been cleared and old values are gone.

Limitation: if an attribute was expired (not loaded into identity map) and then set
without a prior load, hist.deleted and hist.unchanged are both empty. In that case
we record None for that field in old_values. This should not happen in normal import
flows where we always load the object before modifying it.
"""

import uuid
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
import contextvars

from sqlalchemy import event, inspect as sa_inspect
from sqlalchemy.orm import Session


# Context vars — set in request middleware/dependency or at task start
current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_user_id", default=None
)
current_import_job_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_import_job_id", default=None
)
current_worker_task: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_worker_task", default=None
)


def _serialize_value(val):
    """Convert Python values to JSON-serializable primitives for JSONB storage."""
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


def _obj_to_dict(obj) -> dict:
    """Serialize all column-level attributes of an ORM object to a plain dict."""
    result = {}
    for col_attr in sa_inspect(obj.__class__).mapper.column_attrs:
        result[col_attr.key] = _serialize_value(getattr(obj, col_attr.key))
    return result


def _capture_old_values(obj) -> dict:
    """
    Capture the pre-change state of a dirty object.

    Uses SQLAlchemy attribute history which is only available before the flush
    resets it. For each column attribute:
      - hist.deleted[0]  → the old value (field was changed)
      - hist.unchanged[0] → current value (field was not changed)
      - neither          → attribute was not loaded before being set; records None
    """
    result = {}
    insp = sa_inspect(obj)
    for col_attr in sa_inspect(obj.__class__).mapper.column_attrs:
        key = col_attr.key
        hist = insp.attrs[key].history
        if hist.deleted:
            result[key] = _serialize_value(hist.deleted[0])
        elif hist.unchanged:
            result[key] = _serialize_value(hist.unchanged[0])
        else:
            # Attribute was set without a prior load — old value unknowable
            result[key] = None
    return result


def _should_audit(obj) -> bool:
    cls = obj.__class__
    return hasattr(cls, "__auditable__") or hasattr(cls, "__revertable__")


def _should_revert(obj) -> bool:
    return hasattr(obj.__class__, "__revertable__")


def _entity_type(obj) -> str:
    # tablename → singular entity type: assets→asset, employees→employee, etc.
    return obj.__tablename__.rstrip("s")


@event.listens_for(Session, "before_flush")
def _before_flush(session, flush_context, instances):
    """
    Collect audit entries before the flush executes.
    This is the only moment where old values are still accessible via history.
    """
    pending = []

    for obj in list(session.new):
        if not _should_audit(obj):
            continue
        pending.append({"action": "create", "obj": obj, "old": None})

    for obj in list(session.dirty):
        if not _should_audit(obj):
            continue
        pending.append({"action": "update", "obj": obj, "old": _capture_old_values(obj)})

    for obj in list(session.deleted):
        if not _should_audit(obj):
            continue
        # Full snapshot before delete — use _obj_to_dict not history,
        # because deleted objects still have their current values intact.
        pending.append({"action": "delete", "obj": obj, "old": _obj_to_dict(obj)})

    session._pending_audit = pending


@event.listens_for(Session, "after_flush")
def _after_flush(session, flush_context):
    """
    Write DataAuditLog and SqlRevertLog records using the entries collected in before_flush.
    New records are added to the session and will be flushed before commit.
    They are not auditable themselves so no recursion occurs.
    """
    pending = getattr(session, "_pending_audit", [])
    if not pending:
        return

    job_id_str = current_import_job_id.get()
    actor_id_str = current_user_id.get()
    worker_task = current_worker_task.get()

    actor_type = "worker" if worker_task else ("user" if actor_id_str else "system")
    job_id = uuid.UUID(job_id_str) if job_id_str else None
    actor_id = uuid.UUID(actor_id_str) if actor_id_str else None

    if not hasattr(session, "_revert_sequence"):
        session._revert_sequence = {}

    # Late imports to avoid circular dependencies at module load time
    from app.models.data_audit_log import DataAuditLog
    from app.models.sql_revert_log import SqlRevertLog

    for entry in pending:
        obj = entry["obj"]
        action = entry["action"]
        old = entry["old"]
        new_values = _obj_to_dict(obj) if action != "delete" else None

        audit = DataAuditLog(
            tenant_id=obj.tenant_id,
            organization_id=getattr(obj, "organization_id", None),
            import_job_id=getattr(obj, "import_job_id", None) or job_id,
            actor_type=actor_type,
            actor_id=actor_id,
            worker_task=worker_task,
            action=action,
            entity_type=_entity_type(obj),
            entity_id=obj.id,
            old_values=old,
            new_values=new_values,
        )
        session.add(audit)

        if _should_revert(obj) and job_id:
            seq_key = str(job_id)
            session._revert_sequence[seq_key] = (
                session._revert_sequence.get(seq_key, 0) + 1
            )
            seq = session._revert_sequence[seq_key]

            if action == "create":
                revert_data = {"table": obj.__tablename__, "pk": str(obj.id)}
            elif action == "update":
                revert_data = {
                    "table": obj.__tablename__,
                    "pk": str(obj.id),
                    "old_values": old,
                }
            else:  # delete
                revert_data = {"table": obj.__tablename__, "old_values": old}

            revert = SqlRevertLog(
                tenant_id=obj.tenant_id,
                organization_id=getattr(obj, "organization_id", None),
                import_job_id=job_id,
                entity_type=_entity_type(obj),
                entity_id=obj.id,
                action=action,
                revert_data=revert_data,
                sequence=seq,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
            )
            session.add(revert)

    session._pending_audit = []


def register_listeners():
    """
    No-op — listeners are registered at module import time via @event.listens_for.
    Call this from main.py to ensure this module is imported at startup.
    """
    pass
