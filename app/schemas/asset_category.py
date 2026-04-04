import uuid
from datetime import datetime
from pydantic import BaseModel


class AssetCategoryBase(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    sort_order: int = 0
    is_active: bool = True


class AssetCategoryCreate(AssetCategoryBase):
    pass


class AssetCategoryModify(BaseModel):
    name: str | None = None
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class AssetCategoryResponse(AssetCategoryBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
