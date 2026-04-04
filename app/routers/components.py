import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.component import Component, ComponentCompatibility
from app.schemas.component import (
    ComponentCreate, ComponentModify, ComponentResponse,
    ComponentCompatibilityCreate, ComponentCompatibilityResponse,
)
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/components", tags=["components"])


@router.get("/", response_model=PagedResponse[ComponentResponse])
def list_components(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("component:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Component).filter(Component.tenant_id == user.tenant_id)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{component_id}", response_model=ComponentResponse)
def get_component(
    component_id: uuid.UUID,
    user: User = Depends(require_permission("component:read")),
    db: Session = Depends(get_db),
):
    c = db.query(Component).filter(
        Component.id == component_id, Component.tenant_id == user.tenant_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Component not found")
    return c


@router.post("/", response_model=ComponentResponse, status_code=201)
def create_component(
    data: ComponentCreate,
    user: User = Depends(require_permission("component:write")),
    db: Session = Depends(get_db),
):
    c = Component(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{component_id}", response_model=ComponentResponse)
def update_component(
    component_id: uuid.UUID,
    data: ComponentModify,
    user: User = Depends(require_permission("component:write")),
    db: Session = Depends(get_db),
):
    c = db.query(Component).filter(
        Component.id == component_id, Component.tenant_id == user.tenant_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Component not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.post("/compatibility", response_model=ComponentCompatibilityResponse, status_code=201)
def add_compatibility(
    data: ComponentCompatibilityCreate,
    user: User = Depends(require_permission("component:write")),
    db: Session = Depends(get_db),
):
    cc = ComponentCompatibility(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return cc


@router.delete("/compatibility/{compat_id}", status_code=204)
def delete_compatibility(
    compat_id: uuid.UUID,
    user: User = Depends(require_permission("component:write")),
    db: Session = Depends(get_db),
):
    cc = db.query(ComponentCompatibility).filter(
        ComponentCompatibility.id == compat_id,
        ComponentCompatibility.tenant_id == user.tenant_id,
    ).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Compatibility rule not found")
    db.delete(cc)
    db.commit()
