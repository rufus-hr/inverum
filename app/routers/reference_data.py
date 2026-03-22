import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.reference_data import ReferenceData
from app.schemas.reference_data import ReferenceDataCreate, ReferenceDataModify, ReferenceDataResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/reference-data", tags=["reference-data"])


@router.get("/", response_model=PagedResponse[ReferenceDataResponse])
def list_reference_data(
    category: str | None = Query(default=None),
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("reference_data:read")),
    db: Session = Depends(get_db),
):
    query = db.query(ReferenceData).filter(
        ReferenceData.is_active == True,
        (ReferenceData.tenant_id == user.tenant_id) | (ReferenceData.tenant_id == None),
    )
    if category:
        query = query.filter(ReferenceData.category == category)
    query = query.order_by(ReferenceData.category, ReferenceData.display_order)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{ref_id}", response_model=ReferenceDataResponse)
def get_reference_data(
    ref_id: uuid.UUID,
    user: User = Depends(require_permission("reference_data:read")),
    db: Session = Depends(get_db),
):
    ref = db.query(ReferenceData).filter(
        ReferenceData.id == ref_id,
        (ReferenceData.tenant_id == user.tenant_id) | (ReferenceData.tenant_id == None),
    ).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference data not found")
    return ref


@router.post("/", response_model=ReferenceDataResponse, status_code=201)
def create_reference_data(
    data: ReferenceDataCreate,
    user: User = Depends(require_permission("reference_data:create")),
    db: Session = Depends(get_db),
):
    ref = ReferenceData(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return ref


@router.delete("/{ref_id}", status_code=204)
def delete_reference_data(
    ref_id: uuid.UUID,
    user: User = Depends(require_permission("reference_data:delete")),
    db: Session = Depends(get_db),
):
    ref = db.query(ReferenceData).filter(
        ReferenceData.id == ref_id,
        ReferenceData.tenant_id == user.tenant_id,
        ReferenceData.is_system == False,
    ).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference data not found")
    db.delete(ref)
    db.commit()


@router.put("/{ref_id}", response_model=ReferenceDataResponse)
def update_reference_data(
    ref_id: uuid.UUID,
    data: ReferenceDataModify,
    user: User = Depends(require_permission("reference_data:modify")),
    db: Session = Depends(get_db),
):
    ref = db.query(ReferenceData).filter(
        ReferenceData.id == ref_id,
        ReferenceData.tenant_id == user.tenant_id,
        ReferenceData.is_system == False,
    ).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference data not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ref, field, value)
    db.commit()
    db.refresh(ref)
    return ref
