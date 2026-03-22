import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission, get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserModify
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/", response_model=PagedResponse[UserResponse])
def list_users(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("user:read")),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(
        User.tenant_id == user.tenant_id,
        User.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: uuid.UUID,
    user: User = Depends(require_permission("user:read")),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == user.tenant_id,
        User.deleted_at == None,
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: uuid.UUID,
    data: UserModify,
    user: User = Depends(require_permission("user:modify")),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == user.tenant_id,
        User.deleted_at == None,
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(u, field, value)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: uuid.UUID,
    user: User = Depends(require_permission("user:delete")),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == user.tenant_id,
        User.deleted_at == None,
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.deleted_at = datetime.now(timezone.utc)
    db.commit()
