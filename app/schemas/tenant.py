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


class TenantModules(BaseModel):
    vendors: bool = False
    supplies: bool = False
    storage: bool = False
    maintenance: bool = False
    checklists: bool = False
    advanced_permissions: bool = False


class TenantSettings(BaseModel):
    currency: str = "EUR"
    timezone: str = "Europe/Zagreb"
    date_format: str = "DD.MM.YYYY"
    language: str = "hr"


class TenantConfig(BaseModel):
    """Vraća se na GET /tenant/config — koristi ga frontend useTenantConfig()."""
    tenant_id: uuid.UUID
    name: str
    slug: str
    modules: TenantModules
    settings: TenantSettings


class TenantModulesUpdate(BaseModel):
    vendors: bool | None = None
    supplies: bool | None = None
    storage: bool | None = None
    maintenance: bool | None = None
    checklists: bool | None = None
    advanced_permissions: bool | None = None


class TenantSettingsUpdate(BaseModel):
    currency: str | None = None
    timezone: str | None = None
    date_format: str | None = None
    language: str | None = None
