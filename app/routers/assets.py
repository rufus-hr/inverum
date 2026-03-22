import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetModify, AssetResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams


router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=PagedResponse[AssetResponse])
def list_assets(
    user: User = Depends(require_permission("asset:read")),
    pagination: PaginationParams = Depends(PaginationParams),
    db: Session = Depends(get_db),
):
    query = db.query(Asset).filter(
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    )
    
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit

    return PagedResponse(
      items=items,                                                                                                                                          
      total=total,                                                                                                                                          
      page=pagination.page,
      limit=pagination.limit,                                                                                                                               
      pages=pages,                                          
  )                                                                                                                                                         



@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: uuid.UUID,
    user: User = Depends(require_permission("asset:read")),
    db: Session = Depends(get_db),
):
    a = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")
    return a


@router.post("/", response_model=AssetResponse, status_code=201)
def create_asset(
    data: AssetCreate,
    user: User = Depends(require_permission("asset:create")),
    db: Session = Depends(get_db),
):
    a = Asset(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: uuid.UUID,
    data: AssetModify,
    user: User = Depends(require_permission("asset:modify")),
    db: Session = Depends(get_db),
):
    a = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: uuid.UUID,
    user: User = Depends(require_permission("asset:delete")),
    db: Session = Depends(get_db),
):
    a = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")
    a.deleted_at = datetime.now(timezone.utc)
    db.commit()
