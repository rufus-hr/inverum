import uuid
from datetime import datetime
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# SharedDeskProfile
# ---------------------------------------------------------------------------

class SharedDeskProfileCreate(BaseModel):
    name: str
    location_id: uuid.UUID
    capacity: int
    organization_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None


class SharedDeskProfileUpdate(BaseModel):
    name: str | None = None
    location_id: uuid.UUID | None = None
    capacity: int | None = None
    organization_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None


class SharedDeskProfileResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    location_id: uuid.UUID
    capacity: int
    organization_id: uuid.UUID | None
    department_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class SharedDeskAvailabilityResponse(BaseModel):
    profile_id: uuid.UUID
    name: str
    capacity: int
    occupied: int
    available: int


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

class WorkspaceCreate(BaseModel):
    name: str
    location_id: uuid.UUID
    type: str  # "personal" | "shared"
    assigned_to_user_id: uuid.UUID | None = None
    shared_desk_profile_id: uuid.UUID | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    location_id: uuid.UUID | None = None
    type: str | None = None
    assigned_to_user_id: uuid.UUID | None = None
    shared_desk_profile_id: uuid.UUID | None = None


class WorkspaceAssignRequest(BaseModel):
    user_id: uuid.UUID | None = None  # None = unassign


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    location_id: uuid.UUID
    type: str
    assigned_to_user_id: uuid.UUID | None
    shared_desk_profile_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
