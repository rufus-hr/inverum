import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class AssetEventCreate(BaseModel):
    event_type: str
    description: str
    actor_type: str = "user"
    actor_id: uuid.UUID | None = None
    actor_name: str | None = None
    metadata: dict | None = None


class AssetEventResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    asset_id: uuid.UUID
    event_type: str
    description: str
    actor_type: str
    actor_id: uuid.UUID | None = None
    actor_name: str | None = None
    metadata: dict | None = Field(None, alias="metadata_")
    archived_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
