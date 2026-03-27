import uuid
from datetime import datetime
from pydantic import BaseModel


class DeptBase(BaseModel):
    organization_id: uuid.UUID
    name: str
    code: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    region_id: uuid.UUID | None = None
    language_id: uuid.UUID | None = None
    is_active: bool = True


class DeptCreate(DeptBase):
    pass


class DeptModify(BaseModel):
    organization_id: uuid.UUID | None = None
    name: str | None = None
    code: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    region_id: uuid.UUID | None = None
    language_id: uuid.UUID | None = None
    is_active: bool | None = None


class DeptResponse(DeptBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
