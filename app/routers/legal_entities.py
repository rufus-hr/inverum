import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.legal_entity import LegalEntity
from app.schemas.legal_entity import LegalEntityCreate, LegalEntityModify, LegalEntityResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/legal-entities", tags=["legal-entities"])


@router.get("/", response_model=PagedResponse[LegalEntityResponse])
def list_legal_entities(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("legal_entity:read")),
    db: Session = Depends(get_db),
):
    query = db.query(LegalEntity).filter(
        LegalEntity.tenant_id == user.tenant_id,
        LegalEntity.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{legal_entity_id}", response_model=LegalEntityResponse)
def get_legal_entity(
    legal_entity_id: uuid.UUID,
    user: User = Depends(require_permission("legal_entity:read")),
    db: Session = Depends(get_db),
):
    entity = db.query(LegalEntity).filter(
        LegalEntity.id == legal_entity_id,
        LegalEntity.tenant_id == user.tenant_id,
        LegalEntity.deleted_at == None,
    ).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Legal entity not found")
    return entity


@router.post("/", response_model=LegalEntityResponse, status_code=201)
def create_legal_entity(
    data: LegalEntityCreate,
    user: User = Depends(require_permission("legal_entity:create")),
    db: Session = Depends(get_db),
):
    entity = LegalEntity(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{legal_entity_id}", response_model=LegalEntityResponse)
def update_legal_entity(
    legal_entity_id: uuid.UUID,
    data: LegalEntityModify,
    user: User = Depends(require_permission("legal_entity:modify")),
    db: Session = Depends(get_db),
):
    entity = db.query(LegalEntity).filter(
        LegalEntity.id == legal_entity_id,
        LegalEntity.tenant_id == user.tenant_id,
        LegalEntity.deleted_at == None,
    ).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Legal entity not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entity, field, value)
    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{legal_entity_id}", status_code=204)
def delete_legal_entity(
    legal_entity_id: uuid.UUID,
    user: User = Depends(require_permission("legal_entity:delete")),
    db: Session = Depends(get_db),
):
    entity = db.query(LegalEntity).filter(
        LegalEntity.id == legal_entity_id,
        LegalEntity.tenant_id == user.tenant_id,
        LegalEntity.deleted_at == None,
    ).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Legal entity not found")
    entity.deleted_at = datetime.now(timezone.utc)
    db.commit()
