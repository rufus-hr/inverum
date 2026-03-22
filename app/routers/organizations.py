import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.organizations import Organization
from app.schemas.organization import OrgCreate, OrgModify, OrgResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/", response_model=PagedResponse[OrgResponse])
def list_organizations(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("organization:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Organization).filter(
        Organization.tenant_id == user.tenant_id,
        Organization.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{org_id}", response_model=OrgResponse)
def get_organization(
    org_id: uuid.UUID,
    user: User = Depends(require_permission("organization:read")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.tenant_id == user.tenant_id,
        Organization.deleted_at == None,
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.post("/", response_model=OrgResponse, status_code=201)
def create_organization(
    data: OrgCreate,
    user: User = Depends(require_permission("organization:create")),
    db: Session = Depends(get_db),
):
    org = Organization(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.put("/{org_id}", response_model=OrgResponse)
def update_organization(
    org_id: uuid.UUID,
    data: OrgModify,
    user: User = Depends(require_permission("organization:modify")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.tenant_id == user.tenant_id,
        Organization.deleted_at == None,
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org


@router.delete("/{org_id}", status_code=204)
def delete_organization(
    org_id: uuid.UUID,
    user: User = Depends(require_permission("organization:delete")),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.tenant_id == user.tenant_id,
        Organization.deleted_at == None,
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    from datetime import datetime, timezone
    org.deleted_at = datetime.now(timezone.utc)
    db.commit()
