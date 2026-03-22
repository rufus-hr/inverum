import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantResponse
from app.dependencies.auth import require_permission
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/", response_model=PagedResponse[TenantResponse])
def list_tenants(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("tenant:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Tenant).filter(Tenant.deleted_at == None)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(user: User = Depends(require_permission("tenant:read")), tenant_id: uuid.UUID, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.deleted_at == None).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/", response_model=TenantResponse, status_code=201)
def create_tenant(user: User = Depends(require_permission("tenant:create")), data: TenantCreate, db: Session = Depends(get_db)):
    tenant = Tenant(**data.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant
