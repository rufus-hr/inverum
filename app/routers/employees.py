import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeModify, EmployeeResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams


router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/", response_model=PagedResponse[EmployeeResponse])
def list_employees(
    user: User = Depends(require_permission("employee:read")),
    pagination: PaginationParams = Depends(PaginationParams),
    db: Session = Depends(get_db),
):
    query = db.query(Employee).filter(
        Employee.tenant_id == user.tenant_id,
        Employee.deleted_at == None,
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



@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: uuid.UUID,
    user: User = Depends(require_permission("employee:read")),
    db: Session = Depends(get_db),
):
    e = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == user.tenant_id,
        Employee.deleted_at == None,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    return e


@router.post("/", response_model=EmployeeResponse, status_code=201)
def create_employee(
    data: EmployeeCreate,
    user: User = Depends(require_permission("employee:create")),
    db: Session = Depends(get_db),
):
    e = Employee(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: uuid.UUID,
    data: EmployeeModify,
    user: User = Depends(require_permission("employee:modify")),
    db: Session = Depends(get_db),
):
    e = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == user.tenant_id,
        Employee.deleted_at == None,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/{employee_id}", status_code=204)
def delete_employee(
    employee_id: uuid.UUID,
    user: User = Depends(require_permission("employee:delete")),
    db: Session = Depends(get_db),
):
    e = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == user.tenant_id,
        Employee.deleted_at == None,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    e.deleted_at = datetime.now(timezone.utc)
    db.commit()
