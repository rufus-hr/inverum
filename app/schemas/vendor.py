import uuid
from datetime import datetime
from pydantic import BaseModel


class VendorBase(BaseModel):
    name: str
    oib: str | None = None
    vat_id: str | None = None
    vendor_types: list[str] | None = None
    manufacturer_id: uuid.UUID | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool = True


class VendorCreate(VendorBase):
    pass


class VendorModify(BaseModel):
    name: str | None = None
    oib: str | None = None
    vat_id: str | None = None
    vendor_types: list[str] | None = None
    manufacturer_id: uuid.UUID | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class VendorResponse(VendorBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class VendorStatsResponse(BaseModel):
    vendor_id: uuid.UUID
    vendor_name: str
    total_assets: int
    total_purchase_value: float | None
    currency: str | None
    assets_by_status: dict
    active_contracts: int
    expiring_contracts_90d: int
    work_orders_total: int
    work_orders_open: int
    avg_repair_days: float | None
