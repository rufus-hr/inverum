import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.supply import Supply
from app.models.stock_policy import StockPolicy
from app.models.stock_movement import StockMovement
from app.models.location import Location
from app.schemas.supply import (
    SupplyCreate, SupplyModify, SupplyResponse,
    StockPolicyCreate, StockPolicyResponse,
    StockMovementCreate, StockMovementResponse,
    BulkStockMovementCreate,
)
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/supplies", tags=["supplies"])
stock_router = APIRouter(prefix="/stock", tags=["stock"])


# ---------------------------------------------------------------------------
# Supply CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=PagedResponse[SupplyResponse])
def list_supplies(
    supply_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    vendor_id: uuid.UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("supply:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Supply).filter(
        Supply.tenant_id == user.tenant_id,
        Supply.deleted_at == None,
    )
    if supply_type:
        query = query.filter(Supply.supply_type == supply_type)
    if category:
        query = query.filter(Supply.category == category)
    if vendor_id:
        query = query.filter(Supply.vendor_id == vendor_id)
    total = query.count()
    items = query.order_by(Supply.name).offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.post("/", response_model=SupplyResponse, status_code=201)
def create_supply(
    data: SupplyCreate,
    user: User = Depends(require_permission("supply:write")),
    db: Session = Depends(get_db),
):
    supply = Supply(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(supply)
    db.commit()
    db.refresh(supply)
    return supply


@router.get("/{supply_id}", response_model=SupplyResponse)
def get_supply(
    supply_id: uuid.UUID,
    user: User = Depends(require_permission("supply:read")),
    db: Session = Depends(get_db),
):
    return _get_supply_or_404(supply_id, user.tenant_id, db)


@router.put("/{supply_id}", response_model=SupplyResponse)
def update_supply(
    supply_id: uuid.UUID,
    data: SupplyModify,
    user: User = Depends(require_permission("supply:write")),
    db: Session = Depends(get_db),
):
    supply = _get_supply_or_404(supply_id, user.tenant_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supply, field, value)
    db.commit()
    db.refresh(supply)
    return supply


@router.delete("/{supply_id}", status_code=204)
def delete_supply(
    supply_id: uuid.UUID,
    user: User = Depends(require_permission("supply:delete")),
    db: Session = Depends(get_db),
):
    supply = _get_supply_or_404(supply_id, user.tenant_id, db)
    supply.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Supply stock summary (po svim lokacijama)
# ---------------------------------------------------------------------------

@router.get("/{supply_id}/stock")
def get_supply_stock(
    supply_id: uuid.UUID,
    user: User = Depends(require_permission("supply:read")),
    db: Session = Depends(get_db),
):
    _get_supply_or_404(supply_id, user.tenant_id, db)

    # Agregacija kretanja po lokaciji → current stock = SUM(quantity)
    movements = (
        db.query(
            StockMovement.location_id,
            StockMovement.storage_unit_id,
            StockMovement.box_id,
            func.sum(StockMovement.quantity).label("current_quantity"),
        )
        .filter(
            StockMovement.supply_id == supply_id,
            StockMovement.tenant_id == user.tenant_id,
        )
        .group_by(
            StockMovement.location_id,
            StockMovement.storage_unit_id,
            StockMovement.box_id,
        )
        .all()
    )

    policies = db.query(StockPolicy).filter(
        StockPolicy.supply_id == supply_id,
        StockPolicy.tenant_id == user.tenant_id,
        StockPolicy.deleted_at == None,
        StockPolicy.is_active == True,
    ).all()
    policy_map = {
        (p.location_id, p.storage_unit_id, p.box_id): p for p in policies
    }

    result = []
    for m in movements:
        key = (m.location_id, m.storage_unit_id, m.box_id)
        policy = policy_map.get(key)
        below_minimum = (
            policy and policy.minimum_quantity is not None
            and m.current_quantity < policy.minimum_quantity
        )
        result.append({
            "location_id": str(m.location_id) if m.location_id else None,
            "storage_unit_id": str(m.storage_unit_id) if m.storage_unit_id else None,
            "box_id": str(m.box_id) if m.box_id else None,
            "current_quantity": m.current_quantity,
            "minimum_quantity": policy.minimum_quantity if policy else None,
            "reorder_quantity": policy.reorder_quantity if policy else None,
            "reorder_period_months": policy.reorder_period_months if policy else None,
            "below_minimum": below_minimum,
            "has_threshold": policy is not None and policy.minimum_quantity is not None,
        })

    return {"supply_id": str(supply_id), "locations": result}


# ---------------------------------------------------------------------------
# Stock policies
# ---------------------------------------------------------------------------

@router.get("/{supply_id}/policies", response_model=PagedResponse[StockPolicyResponse])
def list_policies(
    supply_id: uuid.UUID,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("supply:read")),
    db: Session = Depends(get_db),
):
    _get_supply_or_404(supply_id, user.tenant_id, db)
    query = db.query(StockPolicy).filter(
        StockPolicy.supply_id == supply_id,
        StockPolicy.tenant_id == user.tenant_id,
        StockPolicy.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.post("/{supply_id}/policies", response_model=StockPolicyResponse, status_code=201)
def create_policy(
    supply_id: uuid.UUID,
    data: StockPolicyCreate,
    user: User = Depends(require_permission("supply:write")),
    db: Session = Depends(get_db),
):
    _get_supply_or_404(supply_id, user.tenant_id, db)
    _validate_single_parent(data.location_id, data.storage_unit_id, data.box_id)
    _check_stock_location(data.location_id, db)

    payload = data.model_dump()
    payload["supply_id"] = supply_id
    policy = StockPolicy(**payload, tenant_id=user.tenant_id)
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


# ---------------------------------------------------------------------------
# Stock movements
# ---------------------------------------------------------------------------

@router.post("/{supply_id}/move", response_model=StockMovementResponse, status_code=201)
def create_movement(
    supply_id: uuid.UUID,
    data: StockMovementCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    _get_supply_or_404(supply_id, user.tenant_id, db)
    _validate_single_parent(data.location_id, data.storage_unit_id, data.box_id)

    payload = data.model_dump()
    movement = StockMovement(
        **payload,
        tenant_id=user.tenant_id,
        actor_id=user.id,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


# ---------------------------------------------------------------------------
# Quick stock views (scan workflow)
# ---------------------------------------------------------------------------

@stock_router.get("/location/{location_id}")
def stock_at_location(
    location_id: uuid.UUID,
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    return _stock_summary("location_id", location_id, user.tenant_id, db)


@stock_router.get("/storage-unit/{su_id}")
def stock_at_storage_unit(
    su_id: uuid.UUID,
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    return _stock_summary("storage_unit_id", su_id, user.tenant_id, db)


@stock_router.get("/box/{box_id}")
def stock_at_box(
    box_id: uuid.UUID,
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    return _stock_summary("box_id", box_id, user.tenant_id, db)


@stock_router.post("/movement", status_code=201)
def bulk_movement(
    data: BulkStockMovementCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    movements = []
    for m in data.movements:
        _validate_single_parent(m.location_id, m.storage_unit_id, m.box_id)
        movements.append(StockMovement(
            tenant_id=user.tenant_id,
            actor_id=user.id,
            created_at=now,
            **m.model_dump(),
        ))
    db.add_all(movements)
    db.commit()
    return {"created": len(movements)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_supply_or_404(supply_id: uuid.UUID, tenant_id: uuid.UUID, db: Session) -> Supply:
    supply = db.query(Supply).filter(
        Supply.id == supply_id,
        Supply.tenant_id == tenant_id,
        Supply.deleted_at == None,
    ).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    return supply


def _validate_single_parent(location_id, storage_unit_id, box_id):
    count = sum(1 for x in [location_id, storage_unit_id, box_id] if x is not None)
    if count != 1:
        raise HTTPException(
            status_code=400,
            detail="Exactly one of location_id, storage_unit_id, box_id must be provided"
        )


def _check_stock_location(location_id, db: Session):
    if location_id is None:
        return
    loc = db.query(Location).filter(Location.id == location_id).first()
    if loc and not loc.is_stock_location:
        raise HTTPException(
            status_code=400,
            detail="Location is not a stock location (is_stock_location=False)"
        )


def _stock_summary(filter_col: str, filter_val: uuid.UUID, tenant_id: uuid.UUID, db: Session):
    col = getattr(StockMovement, filter_col)
    rows = (
        db.query(
            StockMovement.supply_id,
            func.sum(StockMovement.quantity).label("current_quantity"),
        )
        .filter(col == filter_val, StockMovement.tenant_id == tenant_id)
        .group_by(StockMovement.supply_id)
        .all()
    )
    supply_ids = [r.supply_id for r in rows]
    supplies = {
        s.id: s for s in db.query(Supply).filter(Supply.id.in_(supply_ids)).all()
    }
    return {
        filter_col: str(filter_val),
        "items": [
            {
                "supply_id": str(r.supply_id),
                "name": supplies[r.supply_id].name if r.supply_id in supplies else None,
                "supply_type": supplies[r.supply_id].supply_type if r.supply_id in supplies else None,
                "unit": supplies[r.supply_id].unit if r.supply_id in supplies else None,
                "current_quantity": r.current_quantity,
            }
            for r in rows
        ],
    }
