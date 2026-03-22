import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class AssetBase(BaseModel):
    organization_id: uuid.UUID
    name: str | None = None
    serial_number: str | None = None
    status: str = "in_stock"
    mobility_type: str = "personal"
    legal_entity_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    configuration_id: uuid.UUID | None = None
    vendor_id: uuid.UUID | None = None
    classification_level_id: uuid.UUID | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = None
    purchase_currency: str | None = None
    notes: str | None = None
    custom_fields: dict | None = None
    is_active: bool = True


class AssetCreate(AssetBase):
    pass


class AssetModify(BaseModel):
    organization_id: uuid.UUID | None = None
    name: str | None = None
    serial_number: str | None = None
    status: str | None = None
    mobility_type: str | None = None
    legal_entity_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    configuration_id: uuid.UUID | None = None
    vendor_id: uuid.UUID | None = None
    classification_level_id: uuid.UUID | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = None
    purchase_currency: str | None = None
    notes: str | None = None
    custom_fields: dict | None = None
    is_active: bool | None = None


class AssetResponse(AssetBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
