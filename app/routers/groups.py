import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.group import Group, UserGroup
from app.schemas.group import GroupCreate, GroupModify, GroupResponse, UserGroupCreate, UserGroupResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/", response_model=PagedResponse[GroupResponse])
def list_groups(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("group:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Group).filter(
        Group.tenant_id == user.tenant_id,
        Group.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: uuid.UUID,
    user: User = Depends(require_permission("group:read")),
    db: Session = Depends(get_db),
):
    g = db.query(Group).filter(
        Group.id == group_id,
        Group.tenant_id == user.tenant_id,
        Group.deleted_at == None,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


@router.post("/", response_model=GroupResponse, status_code=201)
def create_group(
    data: GroupCreate,
    user: User = Depends(require_permission("group:create")),
    db: Session = Depends(get_db),
):
    g = Group(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.put("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: uuid.UUID,
    data: GroupModify,
    user: User = Depends(require_permission("group:modify")),
    db: Session = Depends(get_db),
):
    g = db.query(Group).filter(
        Group.id == group_id,
        Group.tenant_id == user.tenant_id,
        Group.deleted_at == None,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(g, field, value)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: uuid.UUID,
    user: User = Depends(require_permission("group:delete")),
    db: Session = Depends(get_db),
):
    g = db.query(Group).filter(
        Group.id == group_id,
        Group.tenant_id == user.tenant_id,
        Group.deleted_at == None,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    g.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{group_id}/members", response_model=UserGroupResponse, status_code=201)
def add_member(
    group_id: uuid.UUID,
    data: UserGroupCreate,
    user: User = Depends(require_permission("group:modify")),
    db: Session = Depends(get_db),
):
    g = db.query(Group).filter(
        Group.id == group_id,
        Group.tenant_id == user.tenant_id,
        Group.deleted_at == None,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    ug = UserGroup(group_id=group_id, **data.model_dump())
    db.add(ug)
    db.commit()
    db.refresh(ug)
    return ug


@router.delete("/{group_id}/members/{user_id}", status_code=204)
def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    user: User = Depends(require_permission("group:modify")),
    db: Session = Depends(get_db),
):
    ug = db.query(UserGroup).filter(
        UserGroup.group_id == group_id,
        UserGroup.user_id == user_id,
    ).first()
    if not ug:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(ug)
    db.commit()
