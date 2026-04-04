import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.asset_category import AssetCategory
from app.schemas.asset_category import AssetCategoryCreate, AssetCategoryModify, AssetCategoryResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/asset-categories", tags=["asset-categories"])


@router.get("/", response_model=PagedResponse[AssetCategoryResponse])
def list_categories(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("assets:read")),
    db: Session = Depends(get_db),
):
    query = db.query(AssetCategory).filter(
        AssetCategory.tenant_id == user.tenant_id,
        AssetCategory.is_active == True,
    ).order_by(AssetCategory.sort_order, AssetCategory.name)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{category_id}", response_model=AssetCategoryResponse)
def get_category(
    category_id: uuid.UUID,
    user: User = Depends(require_permission("assets:read")),
    db: Session = Depends(get_db),
):
    c = db.query(AssetCategory).filter(
        AssetCategory.id == category_id, AssetCategory.tenant_id == user.tenant_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    return c


@router.post("/", response_model=AssetCategoryResponse, status_code=201)
def create_category(
    data: AssetCategoryCreate,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    c = AssetCategory(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{category_id}", response_model=AssetCategoryResponse)
def update_category(
    category_id: uuid.UUID,
    data: AssetCategoryModify,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    c = db.query(AssetCategory).filter(
        AssetCategory.id == category_id, AssetCategory.tenant_id == user.tenant_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: uuid.UUID,
    user: User = Depends(require_permission("assets:write")),
    db: Session = Depends(get_db),
):
    c = db.query(AssetCategory).filter(
        AssetCategory.id == category_id, AssetCategory.tenant_id == user.tenant_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    c.is_active = False
    db.commit()
