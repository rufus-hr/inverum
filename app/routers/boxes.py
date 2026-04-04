import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.box import Box
from app.schemas.box import BoxCreate, BoxModify, BoxResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/boxes", tags=["boxes"])


@router.get("/", response_model=PagedResponse[BoxResponse])
def list_boxes(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("box:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Box).filter(Box.tenant_id == user.tenant_id)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{box_id}", response_model=BoxResponse)
def get_box(
    box_id: uuid.UUID,
    user: User = Depends(require_permission("box:read")),
    db: Session = Depends(get_db),
):
    b = db.query(Box).filter(Box.id == box_id, Box.tenant_id == user.tenant_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Box not found")
    return b


@router.post("/", response_model=BoxResponse, status_code=201)
def create_box(
    data: BoxCreate,
    user: User = Depends(require_permission("box:write")),
    db: Session = Depends(get_db),
):
    b = Box(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.put("/{box_id}", response_model=BoxResponse)
def update_box(
    box_id: uuid.UUID,
    data: BoxModify,
    user: User = Depends(require_permission("box:write")),
    db: Session = Depends(get_db),
):
    b = db.query(Box).filter(Box.id == box_id, Box.tenant_id == user.tenant_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Box not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    db.commit()
    db.refresh(b)
    return b
