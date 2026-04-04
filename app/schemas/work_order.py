import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class WorkOrderBase(BaseModel):
    number: str
    type: str
    title: str
    status: str = "open"
    asset_id: uuid.UUID | None = None
    assignee_type: str | None = None
    assignee_id: uuid.UUID | None = None
    description: str | None = None
    scheduled_at: datetime | None = None
    external_ticket_ref: str | None = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderModify(BaseModel):
    type: str | None = None
    title: str | None = None
    status: str | None = None
    asset_id: uuid.UUID | None = None
    assignee_type: str | None = None
    assignee_id: uuid.UUID | None = None
    description: str | None = None
    scheduled_at: datetime | None = None
    completed_at: datetime | None = None
    findings: str | None = None
    cost: Decimal | None = None
    cost_currency: str | None = None
    external_ticket_ref: str | None = None


class WorkOrderResponse(WorkOrderBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    completed_at: datetime | None = None
    findings: str | None = None
    cost: Decimal | None = None
    cost_currency: str | None = None
    document_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    created_by_event: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
