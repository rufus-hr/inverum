import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorModify, VendorResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("/", response_model=PagedResponse[VendorResponse])
def list_vendors(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("vendor:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Vendor).filter(
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:read")),
    db: Session = Depends(get_db),
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


@router.post("/", response_model=VendorResponse, status_code=201)
def create_vendor(
    data: VendorCreate,
    user: User = Depends(require_permission("vendor:create")),
    db: Session = Depends(get_db),
):
    v = Vendor(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: uuid.UUID,
    data: VendorModify,
    user: User = Depends(require_permission("vendor:modify")),
    db: Session = Depends(get_db),
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(v, field, value)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vendor_id}", status_code=204)
def delete_vendor(
    vendor_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:delete")),
    db: Session = Depends(get_db),
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    v.deleted_at = datetime.now(timezone.utc)
    db.commit()
