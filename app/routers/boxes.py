import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.box import Box
from app.schemas.box import BoxCreate, BoxModify, BoxResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/boxes", tags=["boxes"])


@router.get("/", response_model=PagedResponse[BoxResponse])
def list_boxes(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("box:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Box).filter(
        Box.tenant_id == user.tenant_id,
        Box.deleted_at.is_(None),
    )
    total = query.count()
    items = query.order_by(Box.inventory_number).offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{box_id}", response_model=BoxResponse)
def get_box(
    box_id: uuid.UUID,
    user: User = Depends(require_permission("box:read")),
    db: Session = Depends(get_db),
):
    b = db.query(Box).filter(Box.id == box_id, Box.tenant_id == user.tenant_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Box not found")
    return b


@router.post("/", response_model=BoxResponse, status_code=201)
def create_box(
    data: BoxCreate,
    user: User = Depends(require_permission("box:write")),
    db: Session = Depends(get_db),
):
    b = Box(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.put("/{box_id}", response_model=BoxResponse)
def update_box(
    box_id: uuid.UUID,
    data: BoxModify,
    user: User = Depends(require_permission("box:write")),
    db: Session = Depends(get_db),
):
    b = db.query(Box).filter(Box.id == box_id, Box.tenant_id == user.tenant_id, Box.deleted_at.is_(None)).first()
    if not b:
        raise HTTPException(status_code=404, detail="Box not found")
    prev_status = b.status
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(b, field, value)

    if b.status == "in_transit" and prev_status != "in_transit":
        from app.models.asset import Asset
        from app.services import checklist_service
        box_assets = db.query(Asset).filter(
            Asset.box_id == b.id,
            Asset.tenant_id == user.tenant_id,
            Asset.deleted_at.is_(None),
        ).all()
        for ba in box_assets:
            checklist_service.trigger_event(
                db=db,
                event="box_in_transit",
                asset=ba,
                pending_transition={
                    "type": "box_in_transit",
                    "box_id": str(b.id),
                    "box_inventory_number": b.inventory_number,
                    "destination": b.notes or "Transit",
                },
                triggered_by_user_id=user.id,
            )

    db.commit()
    db.refresh(b)
    return b


@router.delete("/{box_id}", status_code=204)
def delete_box(
    box_id: uuid.UUID,
    user: User = Depends(require_permission("box:write")),
    db: Session = Depends(get_db),
):
    b = db.query(Box).filter(Box.id == box_id, Box.tenant_id == user.tenant_id, Box.deleted_at.is_(None)).first()
    if not b:
        raise HTTPException(status_code=404, detail="Box not found")
    b.deleted_at = datetime.now(timezone.utc)
    db.commit()
