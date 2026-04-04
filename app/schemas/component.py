import uuid
from datetime import datetime
from pydantic import BaseModel


class ComponentBase(BaseModel):
    type: str
    manufacturer_id: uuid.UUID | None = None
    part_number: str | None = None
    serial_number: str | None = None
    specs: dict | None = None
    installed_in_type: str | None = None
    installed_in_id: uuid.UUID | None = None
    parent_component_id: uuid.UUID | None = None
    notes: str | None = None


class ComponentCreate(ComponentBase):
    installed_at: datetime | None = None


class ComponentModify(BaseModel):
    type: str | None = None
    manufacturer_id: uuid.UUID | None = None
    part_number: str | None = None
    serial_number: str | None = None
    specs: dict | None = None
    installed_in_type: str | None = None
    installed_in_id: uuid.UUID | None = None
    parent_component_id: uuid.UUID | None = None
    installed_at: datetime | None = None
    removed_at: datetime | None = None
    notes: str | None = None


class ComponentResponse(ComponentBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    installed_at: datetime | None = None
    removed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComponentCompatibilityCreate(BaseModel):
    component_id: uuid.UUID
    asset_configuration_id: uuid.UUID
    compatibility_type: str
    warning_message: str | None = None


class ComponentCompatibilityResponse(ComponentCompatibilityCreate):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
