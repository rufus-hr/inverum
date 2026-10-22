import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.supply import Supply
from app.models.stock_item import StockItem
from app.models.consumable import Consumable
from app.models.accessory import Accessory
from app.models.stock_policy import StockPolicy
from app.models.stock_movement import StockMovement
from app.models.location import Location
from app.schemas.supply import (
    SupplyCreate, SupplyModify, SupplyResponse,
    StockInstanceCreate, StockInstanceModify, StockInstanceResponse,
    StockPolicyCreate, StockPolicyResponse,
    StockMovementCreate, StockMovementResponse,
    BulkStockMovementCreate,
)
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/supplies", tags=["supplies"])
stock_router = APIRouter(prefix="/stock", tags=["stock"])
movements_router = APIRouter(prefix="/movements", tags=["movements"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_supply_or_404(supply_id: uuid.UUID, tenant_id: uuid.UUID, db: Session) -> Supply:
    s = db.query(Supply).filter(
        Supply.id == supply_id,
        Supply.tenant_id == tenant_id,
        Supply.deleted_at.is_(None),
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supply not found")
    return s


def _validate_single_parent(location_id, storage_unit_id, box_id):
    count = sum(1 for x in [location_id, storage_unit_id, box_id] if x is not None)
    if count != 1:
        raise HTTPException(
            status_code=400,
            detail="Exactly one of location_id, storage_unit_id, box_id must be provided",
        )


def _get_instance(entity_type: str, entity_id: uuid.UUID, tenant_id: uuid.UUID, db: Session):
    model = _entity_model(entity_type)
    obj = db.query(model).filter(
        model.id == entity_id,
        model.tenant_id == tenant_id,
        model.deleted_at.is_(None),
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{entity_type} not found")
    return obj


def _entity_model(entity_type: str):
    return {"consumable": Consumable, "stock_item": StockItem, "accessory": Accessory}[entity_type]


def _qty_field(entity_type: str) -> str:
    return "current_quantity" if entity_type in ("consumable", "accessory") else "quantity"


def _instance_to_response(obj, entity_type: str) -> StockInstanceResponse:
    qty_field = _qty_field(entity_type)
    qty = getattr(obj, qty_field)
    below = qty < obj.minimum_quantity if obj.minimum_quantity else False
    return StockInstanceResponse(
        id=obj.id,
        tenant_id=obj.tenant_id,
        supply_id=obj.supply_id,
        entity_type=entity_type,
        location_id=obj.location_id,
        storage_unit_id=obj.storage_unit_id,
        box_id=getattr(obj, "box_id", None),
        quantity=qty,
        minimum_quantity=obj.minimum_quantity,
        notes=obj.notes,
        linked_asset_id=getattr(obj, "linked_asset_id", None),
        linked_user_id=getattr(obj, "linked_user_id", None),
        is_active=obj.is_active,
        below_minimum=below,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


# ---------------------------------------------------------------------------
# Supply CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=PagedResponse[SupplyResponse])
def list_supplies(
    supply_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    vendor_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("supply:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Supply).filter(
        Supply.tenant_id == user.tenant_id,
        Supply.deleted_at.is_(None),
    )
    if supply_type:
        query = query.filter(Supply.supply_type == supply_type)
    if category:
        query = query.filter(Supply.category == category)
    if vendor_id:
        query = query.filter(Supply.vendor_id == vendor_id)
    if q:
        query = query.filter(
            or_(Supply.name.ilike(f"%{q}%"), Supply.part_number.ilike(f"%{q}%"))
        )
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


@router.patch("/{supply_id}", response_model=SupplyResponse)
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
    # Blokiraj ako postoje aktivne instance
    for model in [Consumable, StockItem, Accessory]:
        count = db.query(model).filter(
            model.supply_id == supply_id,
            model.deleted_at.is_(None),
        ).count()
        if count:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete: {count} active stock instance(s) exist",
            )
    supply.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Supply stock summary po svim lokacijama
# ---------------------------------------------------------------------------

@router.get("/{supply_id}/stock", response_model=list[StockInstanceResponse])
def get_supply_stock(
    supply_id: uuid.UUID,
    user: User = Depends(require_permission("supply:read")),
    db: Session = Depends(get_db),
):
    supply = _get_supply_or_404(supply_id, user.tenant_id, db)
    entity_type = supply.supply_type
    model = _entity_model(entity_type)
    instances = db.query(model).filter(
        model.supply_id == supply_id,
        model.tenant_id == user.tenant_id,
        model.deleted_at.is_(None),
    ).all()
    return [_instance_to_response(obj, entity_type) for obj in instances]


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
        StockPolicy.deleted_at.is_(None),
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
    payload = data.model_dump()
    payload["supply_id"] = supply_id
    policy = StockPolicy(**payload, tenant_id=user.tenant_id)
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


# ---------------------------------------------------------------------------
# Quick movement on a supply (updateja i qty na instanci)
# ---------------------------------------------------------------------------

@router.post("/{supply_id}/move", response_model=StockMovementResponse, status_code=201)
def create_movement_on_supply(
    supply_id: uuid.UUID,
    data: StockMovementCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    if str(data.supply_id) != str(supply_id):
        raise HTTPException(status_code=400, detail="supply_id mismatch")
    return _create_movement(data, user, db)


# ---------------------------------------------------------------------------
# Unified stock instances
# ---------------------------------------------------------------------------

@stock_router.get("/", response_model=PagedResponse[StockInstanceResponse])
def list_stock(
    entity_type: str | None = Query(default=None),
    supply_id: uuid.UUID | None = Query(default=None),
    location_id: uuid.UUID | None = Query(default=None),
    below_minimum: bool | None = Query(default=None),
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    types = ["consumable", "stock_item", "accessory"]
    if entity_type:
        if entity_type not in types:
            raise HTTPException(status_code=400, detail=f"entity_type must be one of {types}")
        types = [entity_type]

    all_items: list[StockInstanceResponse] = []
    for et in types:
        model = _entity_model(et)
        qty_field = _qty_field(et)
        q = db.query(model).filter(
            model.tenant_id == user.tenant_id,
            model.deleted_at.is_(None),
        )
        if supply_id:
            q = q.filter(model.supply_id == supply_id)
        if location_id:
            q = q.filter(model.location_id == location_id)
        for obj in q.all():
            r = _instance_to_response(obj, et)
            if below_minimum is not None and r.below_minimum != below_minimum:
                continue
            all_items.append(r)

    # Pagination manualnom (unija više tablica)
    total = len(all_items)
    pages = (total + pagination.limit - 1) // pagination.limit if pagination.limit else 1
    start = pagination.offset
    end = start + pagination.limit
    return PagedResponse(
        items=all_items[start:end],
        total=total,
        page=pagination.page,
        limit=pagination.limit,
        pages=pages,
    )


@stock_router.post("/", response_model=StockInstanceResponse, status_code=201)
def create_stock_instance(
    data: StockInstanceCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    # Provjeri supply postoji i odgovara entity_type
    supply = db.query(Supply).filter(
        Supply.id == data.supply_id,
        Supply.tenant_id == user.tenant_id,
        Supply.deleted_at.is_(None),
    ).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    if supply.supply_type != data.entity_type:
        raise HTTPException(
            status_code=400,
            detail=f"Supply is of type '{supply.supply_type}', not '{data.entity_type}'",
        )
    _validate_single_parent(data.location_id, data.storage_unit_id, data.box_id)

    model = _entity_model(data.entity_type)
    qty_field = _qty_field(data.entity_type)

    payload = {
        "supply_id": data.supply_id,
        "location_id": data.location_id,
        "storage_unit_id": data.storage_unit_id,
        "box_id": data.box_id,
        qty_field: data.quantity,
        "minimum_quantity": data.minimum_quantity,
        "notes": data.notes,
        "tenant_id": user.tenant_id,
    }
    if data.entity_type in ("consumable", "accessory"):
        payload["linked_asset_id"] = data.linked_asset_id
    if data.entity_type == "accessory":
        payload["linked_user_id"] = data.linked_user_id

    obj = model(**payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _instance_to_response(obj, data.entity_type)


@stock_router.get("/{entity_type}/{entity_id}", response_model=StockInstanceResponse)
def get_stock_instance(
    entity_type: str,
    entity_id: uuid.UUID,
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    obj = _get_instance(entity_type, entity_id, user.tenant_id, db)
    return _instance_to_response(obj, entity_type)


@stock_router.patch("/{entity_type}/{entity_id}", response_model=StockInstanceResponse)
def update_stock_instance(
    entity_type: str,
    entity_id: uuid.UUID,
    data: StockInstanceModify,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    obj = _get_instance(entity_type, entity_id, user.tenant_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _instance_to_response(obj, entity_type)


@stock_router.delete("/{entity_type}/{entity_id}", status_code=204)
def delete_stock_instance(
    entity_type: str,
    entity_id: uuid.UUID,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    obj = _get_instance(entity_type, entity_id, user.tenant_id, db)
    obj.deleted_at = datetime.now(timezone.utc)
    db.commit()


@stock_router.post("/movement", response_model=StockMovementResponse, status_code=201)
def create_stock_movement(
    data: StockMovementCreate,
    user: User = Depends(require_permission("stock:write")),
    db: Session = Depends(get_db),
):
    return _create_movement(data, user, db)


# ---------------------------------------------------------------------------
# Movements ledger
# ---------------------------------------------------------------------------

@movements_router.get("/", response_model=PagedResponse[StockMovementResponse])
def list_movements(
    supply_id: uuid.UUID | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    entity_id: uuid.UUID | None = Query(default=None),
    location_id: uuid.UUID | None = Query(default=None),
    reason: str | None = Query(default=None),
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("stock:read")),
    db: Session = Depends(get_db),
):
    query = db.query(StockMovement).filter(
        StockMovement.tenant_id == user.tenant_id,
    )
    if supply_id:
        query = query.filter(StockMovement.supply_id == supply_id)
    if entity_type:
        query = query.filter(StockMovement.entity_type == entity_type)
    if entity_id:
        query = query.filter(StockMovement.entity_id == entity_id)
    if location_id:
        query = query.filter(StockMovement.location_id == location_id)
    if reason:
        query = query.filter(StockMovement.reason == reason)

    total = query.count()
    items = (
        query.order_by(StockMovement.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
        .all()
    )
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


# ---------------------------------------------------------------------------
# Shared movement logic (updateja qty na instanci + kreira ledger zapis)
# ---------------------------------------------------------------------------

def _create_movement(data: StockMovementCreate, user: User, db: Session) -> StockMovement:
    _validate_single_parent(data.location_id, data.storage_unit_id, data.box_id)

    # Dohvati instancu i provjeri tenant
    obj = _get_instance(data.entity_type, data.entity_id, user.tenant_id, db)

    # Provjeri da supply_id odgovara instanci
    if str(obj.supply_id) != str(data.supply_id):
        raise HTTPException(status_code=400, detail="supply_id doesn't match instance")

    # Updejta qty na instanci
    qty_field = _qty_field(data.entity_type)
    new_qty = getattr(obj, qty_field) + data.quantity
    if new_qty < 0:
        raise HTTPException(
            status_code=409,
            detail=f"Insufficient stock: current={getattr(obj, qty_field)}, requested={data.quantity}",
        )
    setattr(obj, qty_field, new_qty)

    # Kreira ledger zapis
    movement = StockMovement(
        tenant_id=user.tenant_id,
        supply_id=data.supply_id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        location_id=data.location_id,
        storage_unit_id=data.storage_unit_id,
        box_id=data.box_id,
        quantity=data.quantity,
        reason=data.reason,
        actor_id=user.id,
        work_order_id=data.work_order_id,
        external_ref=data.external_ref,
        notes=data.notes,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement
