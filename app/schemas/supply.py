import uuid
from datetime import datetime
from pydantic import BaseModel


class SupplyCreate(BaseModel):
    name: str
    supply_type: str  # consumable | stock_item
    category: str | None = None
    unit: str = "kom"
    compatible_with: str | None = None
    unit_price: float | None = None
    currency: str | None = None
    vendor_id: uuid.UUID | None = None
    notes: str | None = None


class SupplyModify(BaseModel):
    name: str | None = None
    supply_type: str | None = None
    category: str | None = None
    unit: str | None = None
    compatible_with: str | None = None
    unit_price: float | None = None
    currency: str | None = None
    vendor_id: uuid.UUID | None = None
    notes: str | None = None


class SupplyResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    supply_type: str
    category: str | None = None
    unit: str
    compatible_with: str | None = None
    unit_price: float | None = None
    currency: str | None = None
    vendor_id: uuid.UUID | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockPolicyCreate(BaseModel):
    supply_id: uuid.UUID
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    minimum_quantity: int | None = None
    reorder_quantity: int | None = None
    reorder_period_months: int | None = None
    responsible_user_id: uuid.UUID | None = None
    notes: str | None = None


class StockPolicyResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    supply_id: uuid.UUID
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    minimum_quantity: int | None = None
    reorder_quantity: int | None = None
    reorder_period_months: int | None = None
    responsible_user_id: uuid.UUID | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StockMovementCreate(BaseModel):
    supply_id: uuid.UUID
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    quantity: int  # pozitivno = dodavanje, negativno = uzimanje
    reason: str   # purchase | usage | transfer | adjustment | wasted
    work_order_id: uuid.UUID | None = None
    external_ref: str | None = None
    notes: str | None = None


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    supply_id: uuid.UUID
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    quantity: int
    reason: str
    actor_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    external_ref: str | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkStockMovementCreate(BaseModel):
    """Quick stock movement — scan workflow."""
    movements: list[StockMovementCreate]
    # location/storage_unit/box je u svakom StockMovementCreate
