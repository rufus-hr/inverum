import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/audit_log", tags=["audit_log"])


@router.get("/", response_model=PagedResponse[AuditLogResponse])
def list_audit_logs(
    entity_type: str | None = Query(default=None),
    entity_id: uuid.UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("audit_log:read")),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).filter(
        AuditLog.tenant_id == user.tenant_id,
    )
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{audit_log_id}", response_model=AuditLogResponse)
def get_audit_log(
    audit_log_id: uuid.UUID,
    user: User = Depends(require_permission("audit_log:read")),
    db: Session = Depends(get_db),
):
    a = db.query(AuditLog).filter(
        AuditLog.id == audit_log_id,
        AuditLog.tenant_id == user.tenant_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return a