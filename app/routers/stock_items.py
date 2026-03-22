import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.stock_item import StockItem
from app.schemas.stock_item import StockItemCreate, StockItemModify, StockItemResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/stock-items", tags=["stock-items"])


@router.get("/", response_model=PagedResponse[StockItemResponse])
def list_stock_items(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("stock_item:read")),
    db: Session = Depends(get_db),
):
    query = db.query(StockItem).filter(
        StockItem.tenant_id == user.tenant_id,
        StockItem.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{stock_item_id}", response_model=StockItemResponse)
def get_stock_item(
    stock_item_id: uuid.UUID,
    user: User = Depends(require_permission("stock_item:read")),
    db: Session = Depends(get_db),
):
    s = db.query(StockItem).filter(
        StockItem.id == stock_item_id,
        StockItem.tenant_id == user.tenant_id,
        StockItem.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock item not found")
    return s


@router.post("/", response_model=StockItemResponse, status_code=201)
def create_stock_item(
    data: StockItemCreate,
    user: User = Depends(require_permission("stock_item:create")),
    db: Session = Depends(get_db),
):
    s = StockItem(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{stock_item_id}", response_model=StockItemResponse)
def update_stock_item(
    stock_item_id: uuid.UUID,
    data: StockItemModify,
    user: User = Depends(require_permission("stock_item:modify")),
    db: Session = Depends(get_db),
):
    s = db.query(StockItem).filter(
        StockItem.id == stock_item_id,
        StockItem.tenant_id == user.tenant_id,
        StockItem.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock item not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{stock_item_id}", status_code=204)
def delete_stock_item(
    stock_item_id: uuid.UUID,
    user: User = Depends(require_permission("stock_item:delete")),
    db: Session = Depends(get_db),
):
    s = db.query(StockItem).filter(
        StockItem.id == stock_item_id,
        StockItem.tenant_id == user.tenant_id,
        StockItem.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock item not found")
    s.deleted_at = datetime.now(timezone.utc)
    db.commit()
