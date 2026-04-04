import uuid
from datetime import datetime
from pydantic import BaseModel


class BoxBase(BaseModel):
    inventory_number: str
    location_id: uuid.UUID
    parent_box_id: uuid.UUID | None = None
    status: str = "open"
    notes: str | None = None


class BoxCreate(BoxBase):
    pass


class BoxModify(BaseModel):
    inventory_number: str | None = None
    location_id: uuid.UUID | None = None
    parent_box_id: uuid.UUID | None = None
    status: str | None = None
    notes: str | None = None


class BoxResponse(BoxBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
