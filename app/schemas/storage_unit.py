import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class StorageUnitCreate(BaseModel):
    name: str
    type: str  # rack | cabinet | safe | cage | shelf | drawer
    location_id: uuid.UUID
    parent_storage_unit_id: uuid.UUID | None = None
    is_lockable: bool = False
    security_level: int = Field(default=1, ge=1, le=5)
    capacity: int | None = None
    notes: str | None = None


class StorageUnitModify(BaseModel):
    name: str | None = None
    type: str | None = None
    location_id: uuid.UUID | None = None
    parent_storage_unit_id: uuid.UUID | None = None
    is_lockable: bool | None = None
    security_level: int | None = Field(default=None, ge=1, le=5)
    capacity: int | None = None
    notes: str | None = None


class StorageUnitResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    type: str
    location_id: uuid.UUID
    parent_storage_unit_id: uuid.UUID | None = None
    is_lockable: bool
    security_level: int
    capacity: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlaceInStorageUnit(BaseModel):
    storage_unit_id: uuid.UUID


class BreadcrumbItem(BaseModel):
    type: str  # location | storage_unit | box | asset
    id: uuid.UUID
    name: str


class AssetLocationResponse(BaseModel):
    asset_id: uuid.UUID
    direct_parent_type: str  # location | storage_unit | box
    direct_parent_id: uuid.UUID
    effective_location_id: uuid.UUID | None
    effective_location_name: str | None
    breadcrumb: list[BreadcrumbItem]
    in_transit: bool
