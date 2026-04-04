import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.consumable import Consumable
from app.schemas.consumable import ConsumableCreate, ConsumableModify, ConsumableResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/consumables", tags=["consumables"])


@router.get("/", response_model=PagedResponse[ConsumableResponse])
def list_consumables(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Consumable).filter(
        Consumable.tenant_id == user.tenant_id,
        Consumable.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{consumable_id}", response_model=ConsumableResponse)
def get_consumable(
    consumable_id: uuid.UUID,
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    c = db.query(Consumable).filter(
        Consumable.id == consumable_id,
        Consumable.tenant_id == user.tenant_id,
        Consumable.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consumable not found")
    return c


@router.post("/", response_model=ConsumableResponse, status_code=201)
def create_consumable(
    data: ConsumableCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    c = Consumable(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{consumable_id}", response_model=ConsumableResponse)
def update_consumable(
    consumable_id: uuid.UUID,
    data: ConsumableModify,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    c = db.query(Consumable).filter(
        Consumable.id == consumable_id,
        Consumable.tenant_id == user.tenant_id,
        Consumable.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consumable not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{consumable_id}", status_code=204)
def delete_consumable(
    consumable_id: uuid.UUID,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    c = db.query(Consumable).filter(
        Consumable.id == consumable_id,
        Consumable.tenant_id == user.tenant_id,
        Consumable.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consumable not found")
    c.deleted_at = datetime.now(timezone.utc)
    db.commit()
