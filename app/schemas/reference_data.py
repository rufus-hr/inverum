import uuid
from datetime import datetime
from pydantic import BaseModel


class ReferenceDataBase(BaseModel):
    category: str
    code: str
    label: str
    display_order: int = 0
    is_system: bool = False
    is_active: bool = True
    metadata_: dict | None = None


class ReferenceDataCreate(ReferenceDataBase):
    pass


class ReferenceDataModify(BaseModel):
    label: str | None = None
    display_order: int | None = None
    is_active: bool | None = None
    metadata_: dict | None = None


class ReferenceDataResponse(ReferenceDataBase):
    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
