import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.manufacturer import Manufacturer
from app.schemas.manufacturer import ManufacturerCreate, ManufacturerModify, ManufacturerResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/manufacturers", tags=["manufacturers"])


@router.get("/", response_model=PagedResponse[ManufacturerResponse])
def list_manufacturers(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("manufacturer:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Manufacturer).filter(Manufacturer.deleted_at == None)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{manufacturer_id}", response_model=ManufacturerResponse)
def get_manufacturer(
    manufacturer_id: uuid.UUID,
    user: User = Depends(require_permission("manufacturer:read")),
    db: Session = Depends(get_db),
):
    m = db.query(Manufacturer).filter(
        Manufacturer.id == manufacturer_id,
        Manufacturer.deleted_at == None,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    return m


@router.post("/", response_model=ManufacturerResponse, status_code=201)
def create_manufacturer(
    data: ManufacturerCreate,
    user: User = Depends(require_permission("manufacturer:create")),
    db: Session = Depends(get_db),
):
    m = Manufacturer(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/{manufacturer_id}", response_model=ManufacturerResponse)
def update_manufacturer(
    manufacturer_id: uuid.UUID,
    data: ManufacturerModify,
    user: User = Depends(require_permission("manufacturer:modify")),
    db: Session = Depends(get_db),
):
    m = db.query(Manufacturer).filter(
        Manufacturer.id == manufacturer_id,
        Manufacturer.deleted_at == None,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{manufacturer_id}", status_code=204)
def delete_manufacturer(
    manufacturer_id: uuid.UUID,
    user: User = Depends(require_permission("manufacturer:delete")),
    db: Session = Depends(get_db),
):
    m = db.query(Manufacturer).filter(
        Manufacturer.id == manufacturer_id,
        Manufacturer.deleted_at == None,
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    m.deleted_at = datetime.now(timezone.utc)
    db.commit()
