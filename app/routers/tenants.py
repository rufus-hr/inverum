import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import (
    TenantCreate, TenantResponse, TenantConfig,
    TenantModules, TenantSettings,
    TenantModulesUpdate, TenantSettingsUpdate,
)
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
    query = db.query(Tenant).filter(Tenant.deleted_at.is_(None))
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


# ---------------------------------------------------------------------------
# Tenant config — modules + settings (za trenutnog usera)
# MUST be before /{tenant_id} to avoid routing conflict
# ---------------------------------------------------------------------------

@router.get("/config", response_model=TenantConfig)
def get_tenant_config(
    user: User = Depends(require_permission("tenant:read")),
    db: Session = Depends(get_db),
):
    tenant = db.query(Tenant).filter(
        Tenant.id == user.tenant_id,
        Tenant.deleted_at.is_(None),
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return TenantConfig(
        tenant_id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        modules=TenantModules(**(tenant.modules_enabled or {})),
        settings=TenantSettings(**(tenant.settings or {})),
    )


@router.patch("/config/modules", response_model=TenantConfig)
def update_tenant_modules(
    data: TenantModulesUpdate,
    user: User = Depends(require_permission("tenant:settings")),
    db: Session = Depends(get_db),
):
    tenant = db.query(Tenant).filter(
        Tenant.id == user.tenant_id,
        Tenant.deleted_at.is_(None),
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    current = dict(tenant.modules_enabled or {})
    for key, value in data.model_dump(exclude_none=True).items():
        current[key] = value
    tenant.modules_enabled = current
    db.commit()
    db.refresh(tenant)

    return TenantConfig(
        tenant_id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        modules=TenantModules(**tenant.modules_enabled),
        settings=TenantSettings(**(tenant.settings or {})),
    )


@router.patch("/config/settings", response_model=TenantConfig)
def update_tenant_settings(
    data: TenantSettingsUpdate,
    user: User = Depends(require_permission("tenant:settings")),
    db: Session = Depends(get_db),
):
    tenant = db.query(Tenant).filter(
        Tenant.id == user.tenant_id,
        Tenant.deleted_at.is_(None),
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    current = dict(tenant.settings or {})
    dump = data.model_dump(exclude_none=True)
    new_tenant_name = dump.pop("tenant_name", None)
    if new_tenant_name and str(new_tenant_name).strip():
        tenant.name = str(new_tenant_name).strip()
    for key, value in dump.items():
        current[key] = value
    tenant.settings = current
    db.commit()
    db.refresh(tenant)

    return TenantConfig(
        tenant_id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        modules=TenantModules(**(tenant.modules_enabled or {})),
        settings=TenantSettings(**tenant.settings),
    )


# ---------------------------------------------------------------------------
# CRUD — these MUST be after /config routes
# ---------------------------------------------------------------------------

@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: uuid.UUID, user: User = Depends(require_permission("tenant:read")), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.deleted_at.is_(None)).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/", response_model=TenantResponse, status_code=201)
def create_tenant(data: TenantCreate, user: User = Depends(require_permission("tenant:create")), db: Session = Depends(get_db)):
    tenant = Tenant(**data.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant
