import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel

AssignedToType = Literal["user", "workplace", "location", "stock", "department"]


class AssetAssignCreate(BaseModel):
    asset_id: uuid.UUID
    assigned_to_type: AssignedToType
    assigned_to_id: uuid.UUID | None = None
    notes: str | None = None


class AssetAssignReturn(BaseModel):
    notes: str | None = None


class AssetAssignmentResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    asset_id: uuid.UUID
    assigned_to_type: str
    assigned_to_id: uuid.UUID | None = None
    assigned_by: uuid.UUID
    assigned_at: datetime
    returned_at: datetime | None = None
    returned_by: uuid.UUID | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
