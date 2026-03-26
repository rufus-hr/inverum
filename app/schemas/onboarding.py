from pydantic import BaseModel
import uuid


class AdminUserRequest(BaseModel):
    username: str
    password: str


class TenantOnboardingRequest(BaseModel):
    name: str
    slug: str
    auth_method: str        # local | ldap
    permission_tier: str    # simple | basic | standard | enterprise
    region_code: str = "HR"
    language_code: str = "hr"
    admin_user: AdminUserRequest


class TenantOnboardingResponse(BaseModel):
    tenant_id: uuid.UUID
    tenant_slug: str
    access_token: str
    refresh_token: str
