import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class ConsumableBase(BaseModel):
    location_id: uuid.UUID
    name: str
    unit: str = "pcs"
    current_quantity: int = 0
    minimum_quantity: int = 0
    manufacturer_id: uuid.UUID | None = None
    part_number: str | None = None
    unit_cost: Decimal | None = None
    currency: str | None = None
    box_id: uuid.UUID | None = None
    linked_asset_id: uuid.UUID | None = None
    notes: str | None = None
    is_active: bool = True


class ConsumableCreate(ConsumableBase):
    pass


class ConsumableModify(BaseModel):
    location_id: uuid.UUID | None = None
    name: str | None = None
    unit: str | None = None
    current_quantity: int | None = None
    minimum_quantity: int | None = None
    manufacturer_id: uuid.UUID | None = None
    part_number: str | None = None
    unit_cost: Decimal | None = None
    currency: str | None = None
    box_id: uuid.UUID | None = None
    linked_asset_id: uuid.UUID | None = None
    notes: str | None = None
    is_active: bool | None = None


class ConsumableResponse(ConsumableBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
