import uuid
from datetime import datetime, timezone
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.auth import require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams
from app.models.asset import Asset
from app.models.asset_assignment import AssetAssignment
from app.models.user import User
from app.schemas.asset_assignment import (
    AssetAssignCreate,
    AssetAssignReturn,
    AssetAssignmentResponse,
    AssignmentPendingResponse,
)
from app.schemas.pagination import PagedResponse
from app.services import event_bus_service

router = APIRouter(prefix="/asset-assignments", tags=["asset-assignments"])


@router.get("/", response_model=PagedResponse[AssetAssignmentResponse])
def list_assignments(
    asset_id: uuid.UUID | None = None,
    is_active: bool | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("asset_assignment:read")),
    db: Session = Depends(get_db),
):
    q = db.query(AssetAssignment).filter(AssetAssignment.tenant_id == user.tenant_id)
    if asset_id is not None:
        q = q.filter(AssetAssignment.asset_id == asset_id)
    if is_active is not None:
        q = q.filter(AssetAssignment.is_active == is_active)
    total = q.count()
    items = q.order_by(AssetAssignment.assigned_at.desc()).offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page, limit=pagination.limit, pages=pages)


@router.get("/{assignment_id}", response_model=AssetAssignmentResponse)
def get_assignment(
    assignment_id: uuid.UUID,
    user: User = Depends(require_permission("asset_assignment:read")),
    db: Session = Depends(get_db),
):
    a = db.query(AssetAssignment).filter(
        AssetAssignment.id == assignment_id,
        AssetAssignment.tenant_id == user.tenant_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return a


@router.post(
    "/",
    responses={
        201: {"model": AssetAssignmentResponse},
        202: {"model": AssignmentPendingResponse},
    },
    status_code=201,
)
def assign_asset(
    data: AssetAssignCreate,
    user: User = Depends(require_permission("asset_assignment:create")),
    db: Session = Depends(get_db),
) -> Union[AssetAssignmentResponse, AssignmentPendingResponse]:
    asset = _get_asset(db, data.asset_id, user.tenant_id)

    if asset.mobility_type == "fixed" and data.assigned_to_type in ("user", "workplace"):
        raise HTTPException(
            status_code=422,
            detail="Asset has mobility_type='fixed' and cannot be assigned to a user or workplace",
        )

    if asset.is_checklist_pending:
        raise HTTPException(
            status_code=422,
            detail="Asset has a pending checklist — complete or cancel it before reassigning",
        )

    existing = _active_assignment(db, asset.id)
    event_type = "asset_reassigned" if existing else "asset_assigned"

    pending_transition = {
        "type": "assignment_change",
        "assigned_to_type": data.assigned_to_type,
        "assigned_to_id": str(data.assigned_to_id) if data.assigned_to_id else None,
        "assigned_by_id": str(user.id),
        "notes": data.notes,
        "close_assignment_id": str(existing.id) if existing else None,
    }

    event_bus_service.publish(
        db=db,
        tenant_id=user.tenant_id,
        event_type=event_type,
        entity_type="asset",
        entity_id=asset.id,
        payload={
            "pending_transition": pending_transition,
            "triggered_by_user_id": str(user.id),
        },
    )

    # Execute assignment immediately — checklist (if any) created async by subscriber
    now = datetime.now(timezone.utc)
    if existing:
        existing.returned_at = now
        existing.returned_by = user.id
        existing.is_active = False

    new_assignment = AssetAssignment(
        tenant_id=user.tenant_id,
        asset_id=asset.id,
        assigned_to_type=data.assigned_to_type,
        assigned_to_id=data.assigned_to_id,
        assigned_by=user.id,
        notes=data.notes,
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    return new_assignment


@router.post("/{assignment_id}/return", response_model=AssetAssignmentResponse)
def return_asset(
    assignment_id: uuid.UUID,
    data: AssetAssignReturn,
    user: User = Depends(require_permission("asset_assignment:modify")),
    db: Session = Depends(get_db),
):
    a = db.query(AssetAssignment).filter(
        AssetAssignment.id == assignment_id,
        AssetAssignment.tenant_id == user.tenant_id,
        AssetAssignment.returned_at.is_(None),
        AssetAssignment.is_active == True,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found or already returned")

    asset = _get_asset(db, a.asset_id, user.tenant_id)

    if asset.is_checklist_pending:
        raise HTTPException(
            status_code=422,
            detail="Asset has a pending checklist — complete or cancel it before returning",
        )

    event_bus_service.publish(
        db=db,
        tenant_id=user.tenant_id,
        event_type="asset_returned",
        entity_type="asset",
        entity_id=asset.id,
        payload={
            "pending_transition": {
                "type": "return_to_stock",
                "assignment_id": str(a.id),
                "returned_by_id": str(user.id),
                "notes": data.notes,
            },
            "triggered_by_user_id": str(user.id),
        },
    )

    now = datetime.now(timezone.utc)
    a.returned_at = now
    a.returned_by = user.id
    a.is_active = False
    if data.notes:
        a.notes = data.notes
    db.commit()
    db.refresh(a)
    return a


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_asset(db: Session, asset_id: uuid.UUID, tenant_id: uuid.UUID) -> Asset:
    asset = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == tenant_id,
        Asset.deleted_at.is_(None),
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


def _active_assignment(db: Session, asset_id: uuid.UUID) -> AssetAssignment | None:
    return db.query(AssetAssignment).filter(
        AssetAssignment.asset_id == asset_id,
        AssetAssignment.returned_at.is_(None),
        AssetAssignment.is_active == True,
    ).first()
