import uuid
from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID | None = None
    email: str | None = None
    display_name: str
    avatar_url: str | None = None
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserModify(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    employee_id: uuid.UUID | None = None
    is_active: bool | None = None
