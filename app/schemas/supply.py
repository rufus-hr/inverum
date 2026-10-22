import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Supply (katalog)
# ---------------------------------------------------------------------------

class SupplyCreate(BaseModel):
    name: str
    supply_type: Literal["consumable", "stock_item", "accessory"]
    part_number: str | None = None
    category: str | None = None
    unit: str = "kom"
    compatible_with: str | None = None
    unit_price: Decimal | None = None
    currency: str | None = None
    vendor_id: uuid.UUID | None = None
    manufacturer_id: uuid.UUID | None = None
    notes: str | None = None


class SupplyModify(BaseModel):
    name: str | None = None
    part_number: str | None = None
    category: str | None = None
    unit: str | None = None
    compatible_with: str | None = None
    unit_price: Decimal | None = None
    currency: str | None = None
    vendor_id: uuid.UUID | None = None
    manufacturer_id: uuid.UUID | None = None
    notes: str | None = None
    is_active: bool | None = None


class SupplyResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    supply_type: str
    part_number: str | None = None
    category: str | None = None
    unit: str
    compatible_with: str | None = None
    unit_price: Decimal | None = None
    currency: str | None = None
    vendor_id: uuid.UUID | None = None
    manufacturer_id: uuid.UUID | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Stock instances (unified — consumable | stock_item | accessory)
# ---------------------------------------------------------------------------

class StockInstanceCreate(BaseModel):
    supply_id: uuid.UUID
    entity_type: Literal["consumable", "stock_item", "accessory"]

    # Točno jedan parent
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None

    quantity: int = 0
    minimum_quantity: int = 0
    notes: str | None = None

    # Samo za consumable i accessory:
    linked_asset_id: uuid.UUID | None = None
    # Samo za accessory:
    linked_user_id: uuid.UUID | None = None

    @field_validator("quantity", "minimum_quantity")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("mora biti >= 0")
        return v


class StockInstanceModify(BaseModel):
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    minimum_quantity: int | None = None
    notes: str | None = None
    linked_asset_id: uuid.UUID | None = None
    linked_user_id: uuid.UUID | None = None
    is_active: bool | None = None


class StockInstanceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    supply_id: uuid.UUID
    entity_type: str        # vrsi se u servisnom sloju
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    quantity: int
    minimum_quantity: int
    notes: str | None = None
    linked_asset_id: uuid.UUID | None = None
    linked_user_id: uuid.UUID | None = None
    is_active: bool
    below_minimum: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Stock movements (ledger)
# ---------------------------------------------------------------------------

class StockMovementCreate(BaseModel):
    supply_id: uuid.UUID
    entity_type: Literal["consumable", "stock_item", "accessory"]
    entity_id: uuid.UUID

    # Točno jedan parent
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None

    quantity: int   # pozitivno = dodavanje, negativno = uzimanje
    reason: Literal["purchase", "usage", "transfer", "adjustment", "wasted"]
    work_order_id: uuid.UUID | None = None
    external_ref: str | None = None
    notes: str | None = None


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    supply_id: uuid.UUID
    entity_type: str | None = None
    entity_id: uuid.UUID | None = None
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


# ---------------------------------------------------------------------------
# Stock policies
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Bulk movement (scan workflow)
# ---------------------------------------------------------------------------

class BulkStockMovementCreate(BaseModel):
    movements: list[StockMovementCreate]
