import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleModify, RoleResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=PagedResponse[RoleResponse])
def list_roles(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("role:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Role).filter(
        or_(Role.tenant_id == user.tenant_id, Role.is_system == True),
        Role.is_active == True,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: uuid.UUID,
    user: User = Depends(require_permission("role:read")),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(
        Role.id == role_id,
        or_(Role.tenant_id == user.tenant_id, Role.is_system == True),
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/", response_model=RoleResponse, status_code=201)
def create_role(
    data: RoleCreate,
    user: User = Depends(require_permission("role:create")),
    db: Session = Depends(get_db),
):
    role = Role(**data.model_dump(), tenant_id=user.tenant_id, is_system=False)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: uuid.UUID,
    data: RoleModify,
    user: User = Depends(require_permission("role:modify")),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.tenant_id == user.tenant_id,
        Role.is_system == False,
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    db.commit()
    db.refresh(role)
    return role
