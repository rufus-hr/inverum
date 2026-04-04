import uuid
from datetime import datetime
from pydantic import BaseModel


class MaintenanceScheduleBase(BaseModel):
    name: str
    type: str
    recurrence: str
    asset_id: uuid.UUID | None = None
    asset_configuration_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    asset_type_filter: str | None = None
    assignee_type: str | None = None
    assignee_id: uuid.UUID | None = None
    description: str | None = None
    is_active: bool = True


class MaintenanceScheduleCreate(MaintenanceScheduleBase):
    next_run_at: datetime | None = None


class MaintenanceScheduleModify(BaseModel):
    name: str | None = None
    type: str | None = None
    recurrence: str | None = None
    asset_id: uuid.UUID | None = None
    asset_configuration_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    asset_type_filter: str | None = None
    assignee_type: str | None = None
    assignee_id: uuid.UUID | None = None
    next_run_at: datetime | None = None
    description: str | None = None
    is_active: bool | None = None


class MaintenanceScheduleResponse(MaintenanceScheduleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
