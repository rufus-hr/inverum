import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.external_service import ExternalService, IntegrationRule
from app.schemas.external_service import (
    ExternalServiceCreate, ExternalServiceModify, ExternalServiceResponse,
    IntegrationRuleCreate, IntegrationRuleModify, IntegrationRuleResponse,
)
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/integrations", tags=["integrations"])


# --- External Services ---

@router.get("/services", response_model=PagedResponse[ExternalServiceResponse])
def list_services(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    query = db.query(ExternalService).filter(
        ExternalService.tenant_id == user.tenant_id,
        ExternalService.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/services/{service_id}", response_model=ExternalServiceResponse)
def get_service(
    service_id: uuid.UUID,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    s = db.query(ExternalService).filter(
        ExternalService.id == service_id,
        ExternalService.tenant_id == user.tenant_id,
        ExternalService.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="External service not found")
    return s


@router.post("/services", response_model=ExternalServiceResponse, status_code=201)
def create_service(
    data: ExternalServiceCreate,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    s = ExternalService(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/services/{service_id}", response_model=ExternalServiceResponse)
def update_service(
    service_id: uuid.UUID,
    data: ExternalServiceModify,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    s = db.query(ExternalService).filter(
        ExternalService.id == service_id,
        ExternalService.tenant_id == user.tenant_id,
        ExternalService.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="External service not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/services/{service_id}", status_code=204)
def delete_service(
    service_id: uuid.UUID,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    s = db.query(ExternalService).filter(
        ExternalService.id == service_id,
        ExternalService.tenant_id == user.tenant_id,
        ExternalService.deleted_at == None,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="External service not found")
    s.deleted_at = datetime.now(timezone.utc)
    db.commit()


# --- Integration Rules ---

@router.get("/rules", response_model=PagedResponse[IntegrationRuleResponse])
def list_rules(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    query = db.query(IntegrationRule).filter(
        IntegrationRule.tenant_id == user.tenant_id,
        IntegrationRule.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.post("/rules", response_model=IntegrationRuleResponse, status_code=201)
def create_rule(
    data: IntegrationRuleCreate,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    r = IntegrationRule(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/rules/{rule_id}", response_model=IntegrationRuleResponse)
def update_rule(
    rule_id: uuid.UUID,
    data: IntegrationRuleModify,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    r = db.query(IntegrationRule).filter(
        IntegrationRule.id == rule_id,
        IntegrationRule.tenant_id == user.tenant_id,
        IntegrationRule.deleted_at == None,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Integration rule not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: uuid.UUID,
    user: User = Depends(require_permission("integration:manage")),
    db: Session = Depends(get_db),
):
    r = db.query(IntegrationRule).filter(
        IntegrationRule.id == rule_id,
        IntegrationRule.tenant_id == user.tenant_id,
        IntegrationRule.deleted_at == None,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Integration rule not found")
    r.deleted_at = datetime.now(timezone.utc)
    db.commit()
