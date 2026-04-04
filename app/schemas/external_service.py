import uuid
from datetime import datetime
from pydantic import BaseModel


class ExternalServiceBase(BaseModel):
    name: str
    service_type: str
    base_url: str
    auth_type: str
    is_active: bool = True
    notes: str | None = None


class ExternalServiceCreate(ExternalServiceBase):
    credentials: dict | None = None


class ExternalServiceModify(BaseModel):
    name: str | None = None
    service_type: str | None = None
    base_url: str | None = None
    auth_type: str | None = None
    credentials: dict | None = None
    is_active: bool | None = None
    notes: str | None = None


class ExternalServiceResponse(ExternalServiceBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    last_tested_at: datetime | None = None
    last_test_success: bool | None = None
    created_at: datetime
    updated_at: datetime
    # credentials intentionally excluded from response

    model_config = {"from_attributes": True}


class IntegrationRuleBase(BaseModel):
    external_service_id: uuid.UUID
    name: str
    direction: str
    url_template: str
    trigger_event: str | None = None
    schedule: str | None = None
    payload_template: dict | None = None
    response_mapping: dict | None = None
    conditions: dict | None = None
    retry_count: int = 3
    retry_backoff: bool = True
    is_active: bool = True


class IntegrationRuleCreate(IntegrationRuleBase):
    pass


class IntegrationRuleModify(BaseModel):
    name: str | None = None
    direction: str | None = None
    url_template: str | None = None
    trigger_event: str | None = None
    schedule: str | None = None
    payload_template: dict | None = None
    response_mapping: dict | None = None
    conditions: dict | None = None
    retry_count: int | None = None
    retry_backoff: bool | None = None
    is_active: bool | None = None


class IntegrationRuleResponse(IntegrationRuleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    circuit_breaker_failures: int
    circuit_breaker_opened_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
