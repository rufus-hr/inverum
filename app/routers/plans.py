import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.plan import Plan
from app.schemas.plan import PlanCreate, PlanModify, PlanResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/", response_model=PagedResponse[PlanResponse])
def list_plans(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("assets:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Plan).filter(
        Plan.tenant_id == user.tenant_id,
        Plan.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: uuid.UUID,
    user: User = Depends(require_permission("assets:read")),
    db: Session = Depends(get_db),
):
    p = db.query(Plan).filter(
        Plan.id == plan_id, Plan.tenant_id == user.tenant_id, Plan.deleted_at == None
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")
    return p


@router.post("/", response_model=PlanResponse, status_code=201)
def create_plan(
    data: PlanCreate,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    p = Plan(**data.model_dump(), tenant_id=user.tenant_id, created_by=user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: uuid.UUID,
    data: PlanModify,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    p = db.query(Plan).filter(
        Plan.id == plan_id, Plan.tenant_id == user.tenant_id, Plan.deleted_at == None
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: uuid.UUID,
    user: User = Depends(require_permission("assets:delete")),
    db: Session = Depends(get_db),
):
    p = db.query(Plan).filter(
        Plan.id == plan_id, Plan.tenant_id == user.tenant_id, Plan.deleted_at == None
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")
    p.deleted_at = datetime.now(timezone.utc)
    db.commit()
