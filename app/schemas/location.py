import uuid
from datetime import datetime
from pydantic import BaseModel


class LocationBase(BaseModel):
    location_type_id: uuid.UUID
    name: str
    is_active: bool
    address_street: str | None = None
    address_city: str | None = None
    address_zip: str | None = None
    address_state: str | None = None
    address_country: str | None = None
    organization_id: uuid.UUID | None = None
    legal_entity_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None

class LocationCreate(LocationBase):
    pass


class LocationModify(BaseModel):
    location_type_id: uuid.UUID | None = None
    name: str | None = None
    is_active: bool | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_zip: str | None = None
    address_state: str | None = None
    address_country: str | None = None
    organization_id: uuid.UUID | None = None
    legal_entity_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None


class LocationResponse(LocationBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}