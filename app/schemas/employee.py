import uuid
from datetime import datetime, date
from pydantic import BaseModel


class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    employment_type: str
    email: str | None = None
    phone: str | None = None
    employee_number: str | None = None
    job_title: str | None = None
    job_level: str | None = None
    avatar_url: str | None = None
    external_id: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    organization_id: uuid.UUID | None = None
    legal_entity_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    default_location_id: uuid.UUID | None = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeModify(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    employment_type: str | None = None
    email: str | None = None
    phone: str | None = None
    employee_number: str | None = None
    job_title: str | None = None
    job_level: str | None = None
    avatar_url: str | None = None
    external_id: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    organization_id: uuid.UUID | None = None
    legal_entity_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    default_location_id: uuid.UUID | None = None


class EmployeeResponse(EmployeeBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
