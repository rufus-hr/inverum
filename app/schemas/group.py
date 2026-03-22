import uuid
from datetime import datetime
from pydantic import BaseModel


class GroupBase(BaseModel):
    name: str
    role_id: uuid.UUID
    description: str | None = None
    clearance_level_id: uuid.UUID | None = None
    is_active: bool = True


class GroupCreate(GroupBase):
    pass


class GroupModify(BaseModel):
    name: str | None = None
    role_id: uuid.UUID | None = None
    description: str | None = None
    clearance_level_id: uuid.UUID | None = None
    is_active: bool | None = None


class GroupResponse(GroupBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserGroupCreate(BaseModel):
    user_id: uuid.UUID
    expires_at: datetime | None = None


class UserGroupResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    group_id: uuid.UUID
    expires_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
