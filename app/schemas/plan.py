import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class PlanBase(BaseModel):
    name: str
    type: str
    status: str = "planning"
    location_id: uuid.UUID | None = None
    external_project_ref: str | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    budget_planned: Decimal | None = None
    budget_currency: str | None = None
    notes: str | None = None


class PlanCreate(PlanBase):
    pass


class PlanModify(BaseModel):
    name: str | None = None
    type: str | None = None
    status: str | None = None
    location_id: uuid.UUID | None = None
    external_project_ref: str | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    actual_end: date | None = None
    budget_planned: Decimal | None = None
    budget_actual: Decimal | None = None
    budget_currency: str | None = None
    notes: str | None = None
    approved_by: uuid.UUID | None = None


class PlanResponse(PlanBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    actual_end: date | None = None
    budget_actual: Decimal | None = None
    approved_by: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
