"""
Conflict detection for import validation.
Checks both active records and import_pending records from other jobs.
Uses Valkey for job-level locking.
"""

import uuid
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.core.valkey import client as valkey

from app.models.asset import Asset                                                                                                                        
from app.models.location import Location                                                                                                                  
from app.models.employee import Employee                                                                                                                  
from app.models.vendor import Vendor                      
                                                                                                                                                          
_MODEL_MAP = {
    "asset": Asset,                                                                                                                                       
    "location": Location,                                 
    "employee": Employee,
    "vendor": Vendor,
}


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

    model = _MODEL_MAP.get(entity_type)                                                                                                                       
    if model is None:                                         
        raise ValueError(f"Unknown entity_type: {entity_type}")   

    unique_fields = UNIQUE_FIELDS.get(entity_type, [])                                                                                                        
    conflict_fields = []
    locked_by_job_id = None
    existing_entity_id = None                                                                                                                                 
    
    for field in unique_fields:                                                                                                                               
        value = row_data.get(field)                           
        if value is None:
            continue
        existing = db.query(model).filter(
            model.tenant_id == tenant_id,
            model.deleted_at == None,
            getattr(model, field) == value,
        ).first()
        
        if existing:                                                                                                                                              
            existing_entity_id = existing.id                      
            conflict_fields.append(field)
            key = f"import_lock:{entity_type}:{existing.id}"                                                                                                          
            locked_by = valkey.get(key)                                                                                                                               
            if locked_by and locked_by != str(current_job_id):
                locked_by_job_id = locked_by
            else:
                valkey.set(key, str(current_job_id), ex=_LOCK_TTL, nx=True)
    return ConflictResult (
        has_conflict = len(conflict_fields) > 0,
        existing_entity_id = existing_entity_id,
        locked_by_job_id = uuid.UUID(locked_by_job_id) if locked_by_job_id else None,
        conflict_fields = conflict_fields,
    )
            
            




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
