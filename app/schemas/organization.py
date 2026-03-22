import uuid
from datetime import datetime
from pydantic import BaseModel


class OrgBase(BaseModel):
    legal_entity_id: uuid.UUID
    name: str
    is_active: bool
    parent_id: uuid.UUID | None = None
    classification_level_id: uuid.UUID | None = None
    description: str | None = None


class OrgCreate(OrgBase):
    pass


class OrgModify(BaseModel):
    legal_entity_id: uuid.UUID | None = None
    name: str | None = None
    is_active: bool | None = None
    parent_id: uuid.UUID | None = None
    classification_level_id: uuid.UUID | None = None
    description: str | None = None


class OrgResponse(OrgBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
