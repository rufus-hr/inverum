import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("/", response_model=PagedResponse[PermissionResponse])
def list_permissions(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("permission:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Permission).filter(Permission.is_active == True)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{permission_id}", response_model=PermissionResponse)
def get_permission(
    permission_id: uuid.UUID,
    user: User = Depends(require_permission("permission:read")),
    db: Session = Depends(get_db),
):
    p = db.query(Permission).filter(Permission.id == permission_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Permission not found")
    return p


@router.post("/", response_model=PermissionResponse, status_code=201)
def create_permission(
    data: PermissionCreate,
    user: User = Depends(require_permission("permission:create")),
    db: Session = Depends(get_db),
):
    p = Permission(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
