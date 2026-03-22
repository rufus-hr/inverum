import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.warranty import Warranty
from app.schemas.warranty import WarrantyCreate, WarrantyModify, WarrantyResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/warranties", tags=["warranties"])


@router.get("/", response_model=PagedResponse[WarrantyResponse])
def list_warranties(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("warranty:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Warranty).filter(
        Warranty.tenant_id == user.tenant_id,
        Warranty.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{warranty_id}", response_model=WarrantyResponse)
def get_warranty(
    warranty_id: uuid.UUID,
    user: User = Depends(require_permission("warranty:read")),
    db: Session = Depends(get_db),
):
    w = db.query(Warranty).filter(
        Warranty.id == warranty_id,
        Warranty.tenant_id == user.tenant_id,
        Warranty.deleted_at == None,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Warranty not found")
    return w


@router.post("/", response_model=WarrantyResponse, status_code=201)
def create_warranty(
    data: WarrantyCreate,
    user: User = Depends(require_permission("warranty:create")),
    db: Session = Depends(get_db),
):
    w = Warranty(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


@router.put("/{warranty_id}", response_model=WarrantyResponse)
def update_warranty(
    warranty_id: uuid.UUID,
    data: WarrantyModify,
    user: User = Depends(require_permission("warranty:modify")),
    db: Session = Depends(get_db),
):
    w = db.query(Warranty).filter(
        Warranty.id == warranty_id,
        Warranty.tenant_id == user.tenant_id,
        Warranty.deleted_at == None,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Warranty not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(w, field, value)
    db.commit()
    db.refresh(w)
    return w


@router.delete("/{warranty_id}", status_code=204)
def delete_warranty(
    warranty_id: uuid.UUID,
    user: User = Depends(require_permission("warranty:delete")),
    db: Session = Depends(get_db),
):
    w = db.query(Warranty).filter(
        Warranty.id == warranty_id,
        Warranty.tenant_id == user.tenant_id,
        Warranty.deleted_at == None,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Warranty not found")
    w.deleted_at = datetime.now(timezone.utc)
    db.commit()
