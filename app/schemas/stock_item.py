import uuid
from datetime import datetime
from pydantic import BaseModel


class StockItemBase(BaseModel):
    location_id: uuid.UUID
    name: str
    category: str
    quantity: int = 0
    minimum_quantity: int = 0
    manufacturer_id: uuid.UUID | None = None
    unit_cost: str | None = None
    notes: str | None = None
    is_active: bool = True


class StockItemCreate(StockItemBase):
    pass


class StockItemModify(BaseModel):
    location_id: uuid.UUID | None = None
    name: str | None = None
    category: str | None = None
    quantity: int | None = None
    minimum_quantity: int | None = None
    manufacturer_id: uuid.UUID | None = None
    unit_cost: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class StockItemResponse(StockItemBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
