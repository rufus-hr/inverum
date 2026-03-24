"""
Conflict detection for import validation.
Checks both active records and import_pending records from other jobs.
Uses Valkey for job-level locking.
"""

import uuid
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.core.valkey import client as valkey

# Unique fields per entity type used for conflict detection
UNIQUE_FIELDS: dict[str, list[str]] = {
    "asset": ["serial_number", "inventory_number"],
    "location": ["name"],         # within same tenant + parent
    "employee": ["employee_number", "email"],
    "vendor": ["oib", "vat_id"],
}

_LOCK_TTL = 60 * 60 * 24  # 24h — matches job expires_at


@dataclass
class ConflictResult:
    has_conflict: bool
    existing_entity_id: uuid.UUID | None  # ID of conflicting record
    locked_by_job_id: uuid.UUID | None    # set if another job holds Valkey lock
    conflict_fields: list[str]            # which fields triggered the conflict


def detect_conflict(
    db: Session,
    entity_type: str,
    tenant_id: uuid.UUID,
    row_data: dict,
    current_job_id: uuid.UUID,
) -> ConflictResult:
    """
    Check if row_data conflicts with an existing or import_pending record.

    Flow:
    1. For each unique field, query active + import_pending records
    2. If conflict found, check Valkey lock
    3. If lock held by different job → return locked_by_job_id
    4. If no lock → acquire lock for current job
    """
    # TODO: implement
    # Hints:
    #   - import active records: deleted_at IS NULL, import_job_id IS NULL (or confirmed job)
    #   - import_pending records: deleted_at IS NULL, import_job_id != current_job_id
    #   - Valkey lock key: f"import_lock:{entity_type}:{entity_id}"
    #   - valkey.set(key, str(current_job_id), ex=_LOCK_TTL, nx=True) — only set if not exists
    raise NotImplementedError


def release_locks(entity_type: str, entity_ids: list[uuid.UUID], job_id: uuid.UUID) -> None:
    """
    Release Valkey locks held by job_id for given entities.
    Only releases locks owned by this job (checks value before delete).
    Called on job confirm, rollback, or force-close.
    """
    if valkey is None:
        return
    for entity_id in entity_ids:
        key = f"import_lock:{entity_type}:{entity_id}"
        current = valkey.get(key)
        if current and current == str(job_id):
            valkey.delete(key)
