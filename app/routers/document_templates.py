import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams
from app.models.document_template import DocumentTemplate
from app.models.user import User
from app.schemas.pagination import PagedResponse

router = APIRouter(prefix="/document-templates", tags=["document-templates"])


class DocumentTemplateCreate(BaseModel):
    name: str
    template_type: str = "audit_report"
    engine: str = "typst"  # "svg" | "typst" | "html"
    content: str
    requires_signature: bool = True
    is_active: bool = True


class DocumentTemplateUpdate(BaseModel):
    name: str | None = None
    template_type: str | None = None
    engine: str | None = None
    content: str | None = None
    requires_signature: bool | None = None
    is_active: bool | None = None


class DocumentTemplateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    template_type: str
    engine: str
    content: str
    requires_signature: bool
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=PagedResponse[DocumentTemplateResponse])
def list_document_templates(
    template_type: str | None = None,
    engine: str | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DocumentTemplate).filter(
        DocumentTemplate.tenant_id == user.tenant_id,
        DocumentTemplate.deleted_at.is_(None),
    )
    if template_type:
        query = query.filter(DocumentTemplate.template_type == template_type)
    if engine:
        query = query.filter(DocumentTemplate.engine == engine)

    total = query.count()
    items = (
        query.order_by(DocumentTemplate.name)
        .offset(pagination.offset)
        .limit(pagination.limit)
        .all()
    )
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(
        items=items,
        total=total,
        page=pagination.page,
        limit=pagination.limit,
        pages=pages,
    )


@router.get("/{template_id}", response_model=DocumentTemplateResponse)
def get_document_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")
    return tpl


@router.post("/", response_model=DocumentTemplateResponse, status_code=201)
def create_document_template(
    payload: DocumentTemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = DocumentTemplate(
        tenant_id=user.tenant_id,
        name=payload.name,
        template_type=payload.template_type,
        engine=payload.engine,
        content=payload.content,
        requires_signature=payload.requires_signature,
        is_system=False,
        is_active=payload.is_active,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.put("/{template_id}", response_model=DocumentTemplateResponse)
def update_document_template(
    template_id: uuid.UUID,
    payload: DocumentTemplateUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(tpl, field, val)
    tpl.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
def delete_document_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tpl = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.id == template_id,
            DocumentTemplate.tenant_id == user.tenant_id,
            DocumentTemplate.deleted_at.is_(None),
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Document template not found")
    if tpl.is_system:
        raise HTTPException(status_code=400, detail="System document templates cannot be deleted")

    tpl.deleted_at = datetime.now(timezone.utc)
    db.commit()
