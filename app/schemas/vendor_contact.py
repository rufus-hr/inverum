import uuid
from datetime import datetime
from pydantic import BaseModel


class VendorContactBase(BaseModel):
    name: str
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool = False
    notes: str | None = None


class VendorContactCreate(VendorContactBase):
    pass


class VendorContactModify(BaseModel):
    name: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    is_primary: bool | None = None
    notes: str | None = None


class VendorContactResponse(VendorContactBase):
    id: uuid.UUID
    vendor_id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
