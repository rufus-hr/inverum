import uuid
from datetime import datetime
from pydantic import BaseModel


class RoleBase(BaseModel):
    name: str
    description: str | None = None
    is_active: bool = True


class RoleCreate(RoleBase):
    pass


class RoleModify(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class RoleResponse(RoleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    is_system: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
