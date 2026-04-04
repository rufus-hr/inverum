import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.accessory import Accessory
from app.schemas.accessory import AccessoryCreate, AccessoryModify, AccessoryResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/accessories", tags=["accessories"])


@router.get("/", response_model=PagedResponse[AccessoryResponse])
def list_accessories(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Accessory).filter(
        Accessory.tenant_id == user.tenant_id,
        Accessory.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{accessory_id}", response_model=AccessoryResponse)
def get_accessory(
    accessory_id: uuid.UUID,
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    a = db.query(Accessory).filter(
        Accessory.id == accessory_id,
        Accessory.tenant_id == user.tenant_id,
        Accessory.deleted_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Accessory not found")
    return a


@router.post("/", response_model=AccessoryResponse, status_code=201)
def create_accessory(
    data: AccessoryCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    a = Accessory(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.put("/{accessory_id}", response_model=AccessoryResponse)
def update_accessory(
    accessory_id: uuid.UUID,
    data: AccessoryModify,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    a = db.query(Accessory).filter(
        Accessory.id == accessory_id,
        Accessory.tenant_id == user.tenant_id,
        Accessory.deleted_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Accessory not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{accessory_id}", status_code=204)
def delete_accessory(
    accessory_id: uuid.UUID,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    a = db.query(Accessory).filter(
        Accessory.id == accessory_id,
        Accessory.tenant_id == user.tenant_id,
        Accessory.deleted_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Accessory not found")
    a.deleted_at = datetime.now(timezone.utc)
    db.commit()
