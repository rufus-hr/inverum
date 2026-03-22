import uuid
from datetime import datetime
from pydantic import BaseModel


class PermissionCreate(BaseModel):
    code: str
    name: str
    resource: str
    action: str
    description: str | None = None
    is_active: bool = True


class PermissionResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    resource: str
    action: str
    description: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
