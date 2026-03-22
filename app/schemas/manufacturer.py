import uuid
from datetime import datetime
from pydantic import BaseModel


class ManufacturerBase(BaseModel):
    name: str
    slug: str
    website: str | None = None
    support_url: str | None = None
    support_phone: str | None = None
    api_supported: bool = False
    notes: str | None = None
    is_active: bool = True


class ManufacturerCreate(ManufacturerBase):
    pass


class ManufacturerModify(BaseModel):
    name: str | None = None
    slug: str | None = None
    website: str | None = None
    support_url: str | None = None
    support_phone: str | None = None
    api_supported: bool | None = None
    notes: str | None = None
    is_active: bool | None = None


class ManufacturerResponse(ManufacturerBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
