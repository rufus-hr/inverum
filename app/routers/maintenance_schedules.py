import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.maintenance_schedule import MaintenanceSchedule
from app.schemas.maintenance_schedule import (
    MaintenanceScheduleCreate, MaintenanceScheduleModify, MaintenanceScheduleResponse
)
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/maintenance-schedules", tags=["maintenance-schedules"])


@router.get("/", response_model=PagedResponse[MaintenanceScheduleResponse])
def list_schedules(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("assets:read")),
    db: Session = Depends(get_db),
):
    query = db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.tenant_id == user.tenant_id,
        MaintenanceSchedule.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{schedule_id}", response_model=MaintenanceScheduleResponse)
def get_schedule(
    schedule_id: uuid.UUID,
    user: User = Depends(require_permission("assets:read")),
    db: Session = Depends(get_db),
):
    s = db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.id == schedule_id,
        MaintenanceSchedule.tenant_id == user.tenant_id,
        MaintenanceSchedule.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    return s


@router.post("/", response_model=MaintenanceScheduleResponse, status_code=201)
def create_schedule(
    data: MaintenanceScheduleCreate,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    s = MaintenanceSchedule(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{schedule_id}", response_model=MaintenanceScheduleResponse)
def update_schedule(
    schedule_id: uuid.UUID,
    data: MaintenanceScheduleModify,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    s = db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.id == schedule_id,
        MaintenanceSchedule.tenant_id == user.tenant_id,
        MaintenanceSchedule.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: uuid.UUID,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    s = db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.id == schedule_id,
        MaintenanceSchedule.tenant_id == user.tenant_id,
        MaintenanceSchedule.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    s.deleted_at = datetime.now(timezone.utc)
    db.commit()
