import uuid
from datetime import datetime
from pydantic import BaseModel


class LegalEntityBase(BaseModel):
    name: str
    legal_name: str
    address_street: str | None = None
    address_city: str | None = None
    address_zip: str | None = None
    address_state: str | None = None
    address_country: str | None = None
    is_active: bool = True


class LegalEntityCreate(LegalEntityBase):
    pass


class LegalEntityModify(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_zip: str | None = None
    address_state: str | None = None
    address_country: str | None = None
    is_active: bool | None = None


class LegalEntityResponse(LegalEntityBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
