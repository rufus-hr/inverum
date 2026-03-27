import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.department import Department
from app.schemas.department import DeptCreate, DeptModify, DeptResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("/", response_model=PagedResponse[DeptResponse])
def list_departments(
    organization_id: uuid.UUID | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("department:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Department).filter(
        Department.tenant_id == user.tenant_id,
        Department.deleted_at.is_(None),
    )
    if organization_id is not None:
        query = query.filter(Department.organization_id == organization_id)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{dept_id}", response_model=DeptResponse)
def get_department(
    dept_id: uuid.UUID,
    user: User = Depends(require_permission("department:read")),
    db: Session = Depends(get_db),
):
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.tenant_id == user.tenant_id,
        Department.deleted_at.is_(None),
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.post("/", response_model=DeptResponse, status_code=201)
def create_department(
    data: DeptCreate,
    user: User = Depends(require_permission("department:create")),
    db: Session = Depends(get_db),
):
    if data.parent_id is not None:
        parent = db.query(Department).filter(
            Department.id == data.parent_id,
            Department.tenant_id == user.tenant_id,
            Department.deleted_at.is_(None),
        ).first()
        if not parent:
            raise HTTPException(status_code=422, detail="Parent department not found")
        if parent.organization_id != data.organization_id:
            raise HTTPException(status_code=422, detail="Parent must belong to the same organization")

    dept = Department(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{dept_id}", response_model=DeptResponse)
def update_department(
    dept_id: uuid.UUID,
    data: DeptModify,
    user: User = Depends(require_permission("department:modify")),
    db: Session = Depends(get_db),
):
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.tenant_id == user.tenant_id,
        Department.deleted_at.is_(None),
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    updates = data.model_dump(exclude_unset=True)

    if "parent_id" in updates and updates["parent_id"] is not None:
        parent = db.query(Department).filter(
            Department.id == updates["parent_id"],
            Department.tenant_id == user.tenant_id,
            Department.deleted_at.is_(None),
        ).first()
        if not parent:
            raise HTTPException(status_code=422, detail="Parent department not found")
        org_id = updates.get("organization_id", dept.organization_id)
        if parent.organization_id != org_id:
            raise HTTPException(status_code=422, detail="Parent must belong to the same organization")

    for field, value in updates.items():
        setattr(dept, field, value)
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=204)
def delete_department(
    dept_id: uuid.UUID,
    user: User = Depends(require_permission("department:delete")),
    db: Session = Depends(get_db),
):
    dept = db.query(Department).filter(
        Department.id == dept_id,
        Department.tenant_id == user.tenant_id,
        Department.deleted_at.is_(None),
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.deleted_at = datetime.now(timezone.utc)
    db.commit()
