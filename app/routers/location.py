import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationModify, LocationResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/", response_model=PagedResponse[LocationResponse])
def list_locations(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("location:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Location).filter(
        Location.tenant_id == user.tenant_id,
        Location.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{loc_id}", response_model=LocationResponse)
def get_location(
    loc_id: uuid.UUID,
    user: User = Depends(require_permission("location:read")),
    db: Session = Depends(get_db),
):
    loc = db.query(Location).filter(
        Location.id == loc_id,
        Location.tenant_id == user.tenant_id,
        Location.deleted_at == None,
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@router.post("/", response_model=LocationResponse, status_code=201)
def create_location(
    data: LocationCreate,
    user: User = Depends(require_permission("location:create")),
    db: Session = Depends(get_db),
):
    loc = Location(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/{loc_id}", response_model=LocationResponse)
def update_location(
    loc_id: uuid.UUID,
    data: LocationModify,
    user: User = Depends(require_permission("location:modify")),
    db: Session = Depends(get_db),
):
    loc = db.query(Location).filter(
        Location.id == loc_id,
        Location.tenant_id == user.tenant_id,
        Location.deleted_at == None,
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{loc_id}", status_code=204)
def delete_location(
    loc_id: uuid.UUID,
    user: User = Depends(require_permission("location:delete")),
    db: Session = Depends(get_db),
):
    loc = db.query(Location).filter(
        Location.id == loc_id,
        Location.tenant_id == user.tenant_id,
        Location.deleted_at == None,
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    from datetime import datetime, timezone
    loc.deleted_at = datetime.now(timezone.utc)
    db.commit()
