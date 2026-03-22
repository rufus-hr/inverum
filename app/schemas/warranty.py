import uuid
from datetime import datetime, date
from pydantic import BaseModel


class WarrantyBase(BaseModel):
    asset_id: uuid.UUID
    warranty_type: str
    starts_at: date
    expires_at: date
    vendor_id: uuid.UUID | None = None
    vendor_contract_id: uuid.UUID | None = None
    support_level: str | None = None
    support_phone: str | None = None
    support_email: str | None = None
    support_url: str | None = None
    contract_number: str | None = None
    invoice_number: str | None = None
    auto_renew: bool = False
    notes: str | None = None
    is_active: bool = True


class WarrantyCreate(WarrantyBase):
    pass


class WarrantyModify(BaseModel):
    warranty_type: str | None = None
    starts_at: date | None = None
    expires_at: date | None = None
    vendor_id: uuid.UUID | None = None
    vendor_contract_id: uuid.UUID | None = None
    support_level: str | None = None
    support_phone: str | None = None
    support_email: str | None = None
    support_url: str | None = None
    contract_number: str | None = None
    invoice_number: str | None = None
    auto_renew: bool | None = None
    notes: str | None = None
    is_active: bool | None = None


class WarrantyResponse(WarrantyBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
