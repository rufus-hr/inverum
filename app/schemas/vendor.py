import uuid
from datetime import datetime
from pydantic import BaseModel


class VendorBase(BaseModel):
    name: str
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_zip: str | None = None
    address_state: str | None = None
    address_country: str | None = None
    website: str | None = None
    notes: str | None = None
    is_active: bool = True


class VendorCreate(VendorBase):
    pass


class VendorModify(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_zip: str | None = None
    address_state: str | None = None
    address_country: str | None = None
    website: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class VendorResponse(VendorBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
