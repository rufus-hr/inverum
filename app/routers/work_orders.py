import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.work_order import WorkOrder
from app.schemas.work_order import WorkOrderCreate, WorkOrderModify, WorkOrderResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.get("/", response_model=PagedResponse[WorkOrderResponse])
def list_work_orders(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("work_order:read")),
    db: Session = Depends(get_db),
):
    query = db.query(WorkOrder).filter(
        WorkOrder.tenant_id == user.tenant_id,
        WorkOrder.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{wo_id}", response_model=WorkOrderResponse)
def get_work_order(
    wo_id: uuid.UUID,
    user: User = Depends(require_permission("work_order:read")),
    db: Session = Depends(get_db),
):
    wo = db.query(WorkOrder).filter(
        WorkOrder.id == wo_id, WorkOrder.tenant_id == user.tenant_id, WorkOrder.deleted_at == None
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return wo


@router.post("/", response_model=WorkOrderResponse, status_code=201)
def create_work_order(
    data: WorkOrderCreate,
    user: User = Depends(require_permission("work_order:write")),
    db: Session = Depends(get_db),
):
    wo = WorkOrder(**data.model_dump(), tenant_id=user.tenant_id, created_by=user.id)
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return wo


@router.put("/{wo_id}", response_model=WorkOrderResponse)
def update_work_order(
    wo_id: uuid.UUID,
    data: WorkOrderModify,
    user: User = Depends(require_permission("work_order:write")),
    db: Session = Depends(get_db),
):
    wo = db.query(WorkOrder).filter(
        WorkOrder.id == wo_id, WorkOrder.tenant_id == user.tenant_id, WorkOrder.deleted_at == None
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(wo, field, value)
    db.commit()
    db.refresh(wo)
    return wo


@router.delete("/{wo_id}", status_code=204)
def delete_work_order(
    wo_id: uuid.UUID,
    user: User = Depends(require_permission("work_order:write")),
    db: Session = Depends(get_db),
):
    wo = db.query(WorkOrder).filter(
        WorkOrder.id == wo_id, WorkOrder.tenant_id == user.tenant_id, WorkOrder.deleted_at == None
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    wo.deleted_at = datetime.now(timezone.utc)
    db.commit()
