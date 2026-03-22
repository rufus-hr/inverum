import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.asset_assignment import AssetAssignment
from app.schemas.asset_assignment import AssetAssignCreate, AssetAssignReturn, AssetAssignmentResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/asset-assignments", tags=["asset-assignments"])


@router.get("/", response_model=PagedResponse[AssetAssignmentResponse])
def list_assignments(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("asset_assignment:read")),
    db: Session = Depends(get_db),
):
    query = db.query(AssetAssignment).filter(
        AssetAssignment.tenant_id == user.tenant_id,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
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


@router.post("/", response_model=AssetAssignmentResponse, status_code=201)
def assign_asset(
    data: AssetAssignCreate,
    user: User = Depends(require_permission("asset_assignment:create")),
    db: Session = Depends(get_db),
):
    a = AssetAssignment(
        **data.model_dump(),
        tenant_id=user.tenant_id,
        assigned_by=user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


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
        AssetAssignment.returned_at == None,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found or already returned")
    a.returned_at = datetime.now(timezone.utc)
    a.returned_by = user.id
    a.is_active = False
    if data.notes:
        a.notes = data.notes
    db.commit()
    db.refresh(a)
    return a
