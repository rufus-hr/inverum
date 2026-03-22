import uuid
from datetime import datetime
from pydantic import BaseModel


class TenantBase(BaseModel):
    name: str
    slug: str
    is_active: bool
    max_users: int | None = None
    max_assets: int | None = None
    isolation_mode: str = "row"


class TenantCreate(TenantBase):
    pass


class TenantResponse(TenantBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
