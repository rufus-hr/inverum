import logging
import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.core.valkey import client as valkey
from app.dependencies.db import get_db
from app.models.tenant import Tenant
from app.models.user import User, UserIdentity
from app.models.reference_data import ReferenceData
from app.models.i18n import Language, Region, TenantRegionalSettings
from app.schemas.onboarding import TenantOnboardingRequest, TenantOnboardingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# Tier → which categories/codes to copy from system seeds.
# None as the value means "all codes in that category".
# Phase 2: move this to a config table.
_TIER_MAP: dict[str, dict[str, set[str] | None] | None] = {
    "simple": {
        "asset_status": None,
        "mobility_profile": None,
        "employment_type": None,
        "vendor_type": None,
        "location_type": None,
    },
    "basic": {
        "asset_status": None,
        "mobility_profile": None,
        "employment_type": None,
        "vendor_type": None,
        "location_type": None,
        "classification_level": {"public", "confidential"},
    },
    "standard": {
        "asset_status": None,
        "mobility_profile": None,
        "employment_type": None,
        "vendor_type": None,
        "location_type": None,
        "classification_level": {"public", "internal", "restricted", "confidential"},
    },
    "enterprise": None,  # None = copy all system seeds without filtering
}

VALID_AUTH_METHODS = {"local", "ldap"}
VALID_TIERS = set(_TIER_MAP.keys())


def _require_internal_key(x_internal_key: str = Header(...)) -> None:
    """Phase 1 auth guard — replaced by platform_user JWT in Phase 2."""
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _copy_reference_data(db: Session, tenant_id, tier_filter) -> None:
    """Copy matching system seeds as tenant-owned, non-system records."""
    system_rows = db.query(ReferenceData).filter(
        ReferenceData.tenant_id.is_(None),
        ReferenceData.is_system.is_(True),
    ).all()

    for row in system_rows:
        if tier_filter is not None:
            # Check category allowed
            if row.category not in tier_filter:
                continue
            # Check code allowed (None = all codes in category)
            allowed_codes = tier_filter[row.category]
            if allowed_codes is not None and row.code not in allowed_codes:
                continue

        db.add(ReferenceData(
            tenant_id=tenant_id,
            category=row.category,
            code=row.code,
            label=row.label,
            is_system=False,
            is_active=row.is_active,
            display_order=row.display_order,
            metadata_=row.metadata_,
        ))


@router.post("/tenant", response_model=TenantOnboardingResponse, status_code=201)
def onboard_tenant(
    data: TenantOnboardingRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_require_internal_key),
):
    if data.auth_method not in VALID_AUTH_METHODS:
        raise HTTPException(status_code=422, detail=f"auth_method must be one of: {VALID_AUTH_METHODS}")
    if data.permission_tier not in VALID_TIERS:
        raise HTTPException(status_code=422, detail=f"permission_tier must be one of: {VALID_TIERS}")

    existing = db.query(Tenant).filter_by(slug=data.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Tenant slug '{data.slug}' already exists")

    try:
        tenant = Tenant(
            name=data.name,
            slug=data.slug,
            is_active=True,
        )
        db.add(tenant)
        db.flush()  # get tenant.id

        user = User(
            tenant_id=tenant.id,
            display_name=data.admin_user.username,
            is_active=True,
        )
        db.add(user)
        db.flush()  # get user.id

        db.add(UserIdentity(
            user_id=user.id,
            tenant_id=tenant.id,
            provider="local",
            provider_id=data.admin_user.username,
            metadata_={"password_hash": _hash_password(data.admin_user.password)},
        ))

        tier_filter = _TIER_MAP[data.permission_tier]
        _copy_reference_data(db, tenant.id, tier_filter)

        region = db.query(Region).filter_by(code=data.region_code).first()
        language = db.query(Language).filter_by(code=data.language_code).first()
        if not region:
            raise HTTPException(status_code=422, detail=f"Unknown region_code: {data.region_code}")
        if not language:
            raise HTTPException(status_code=422, detail=f"Unknown language_code: {data.language_code}")

        db.add(TenantRegionalSettings(
            tenant_id=tenant.id,
            language_id=language.id,
            region_id=region.id,
        ))

        db.commit()
        logger.info("Tenant onboarded: slug=%s tier=%s", data.slug, data.permission_tier)

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("Tenant onboarding failed: slug=%s", data.slug)
        raise HTTPException(status_code=500, detail="Onboarding failed — rolled back")

    access_token = create_access_token(user.id, tenant.id)
    refresh_token = create_refresh_token(user.id, tenant.id)

    if valkey is not None:
        valkey.setex(f"refresh:{user.id}", 60 * 60 * 24 * 7, refresh_token)
    else:
        logger.warning("Valkey unavailable — refresh token not stored for user=%s", user.id)

    return TenantOnboardingResponse(
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        access_token=access_token,
        refresh_token=refresh_token,
    )
