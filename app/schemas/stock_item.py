"""
StockItem schema — koristi supply_id (katalog je u Supply tablici).
Ovi schemi su za /stock-items endpoint koji postoji iz starije verzije.
Novi kod koristi /stock endpoint iz supplies routera.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel


class StockItemCreate(BaseModel):
    supply_id: uuid.UUID
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    quantity: int = 0
    minimum_quantity: int = 0
    notes: str | None = None
    is_active: bool = True


class StockItemModify(BaseModel):
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    quantity: int | None = None
    minimum_quantity: int | None = None
    notes: str | None = None
    is_active: bool | None = None


class StockItemResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    supply_id: uuid.UUID
    location_id: uuid.UUID | None = None
    storage_unit_id: uuid.UUID | None = None
    box_id: uuid.UUID | None = None
    quantity: int
    minimum_quantity: int
    notes: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
