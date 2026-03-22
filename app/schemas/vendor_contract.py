import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class VendorContractBase(BaseModel):
    vendor_id: uuid.UUID
    contract_type: str
    legal_entity_id: uuid.UUID | None = None
    contract_number: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    auto_renew: bool = False
    value: Decimal | None = None
    currency: str | None = None
    base_value: Decimal | None = None
    base_currency: str | None = None
    exchange_rate: Decimal | None = None
    exchange_rate_date: date | None = None
    billing_cycle: str | None = None
    account_id: str | None = None
    support_phone: str | None = None
    support_email: str | None = None
    notes: str | None = None
    is_active: bool = True


class VendorContractCreate(VendorContractBase):
    pass


class VendorContractModify(BaseModel):
    contract_type: str | None = None
    legal_entity_id: uuid.UUID | None = None
    contract_number: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    auto_renew: bool | None = None
    value: Decimal | None = None
    currency: str | None = None
    base_value: Decimal | None = None
    base_currency: str | None = None
    exchange_rate: Decimal | None = None
    exchange_rate_date: date | None = None
    billing_cycle: str | None = None
    account_id: str | None = None
    support_phone: str | None = None
    support_email: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class VendorContractResponse(VendorContractBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
