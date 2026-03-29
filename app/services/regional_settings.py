"""
Regional settings fallback chain.
Implements: user_settings → department → organization (recursive) → tenant → region preset
Caches organization tree lookups in Valkey (TTL 5 minutes).
"""
from __future__ import annotations
import json
import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.i18n import UserSettings, TenantRegionalSettings
from app.models.user import User
from app.models.department import Department
from app.core.valkey import client as valkey

_ORG_SETTINGS_TTL = 60 * 5  # 5 minutes


def get_organization_regional_settings(db: Session, organization_id: uuid.UUID) -> dict:
    """
    Walk up the organization tree to find region_id and language_id.
    Cached in Valkey per organization_id (TTL 5 minutes).
    """
    cache_key = f"org_regional:{organization_id}"
    if valkey is not None:
        cached = valkey.get(cache_key)
        if cached:
            return json.loads(cached)

    result = db.execute(text("""
        WITH RECURSIVE org_tree AS (
            SELECT id, parent_id, region_id, language_id, tenant_id
            FROM organizations
            WHERE id = :org_id AND deleted_at IS NULL
            UNION ALL
            SELECT o.id, o.parent_id, o.region_id, o.language_id, o.tenant_id
            FROM organizations o
            JOIN org_tree ot ON o.id = ot.parent_id
            WHERE o.deleted_at IS NULL
        )
        SELECT region_id, language_id
        FROM org_tree
        WHERE region_id IS NOT NULL OR language_id IS NOT NULL
        LIMIT 1
    """), {"org_id": str(organization_id)})
    row = result.fetchone()
    settings = {"region_id": str(row[0]) if row and row[0] else None,
                "language_id": str(row[1]) if row and row[1] else None}

    if valkey is not None:
        valkey.setex(cache_key, _ORG_SETTINGS_TTL, json.dumps(settings))

    return settings


def get_effective_regional_settings(
    db: Session,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict:
    """
    Implements full fallback chain:
    user_settings → department → organization (recursive) → tenant → region preset

    Returns dict with region_id and language_id (UUID strings or None).
    """
    # 1. User settings
    user_settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()

    # 2. Department + organization settings
    user = db.query(User).filter(User.id == user_id).first()
    dept_region_id = None
    dept_language_id = None
    org_settings: dict = {}

    if user and user.department_id:
        dept = db.query(Department).filter(Department.id == user.department_id).first()
        if dept:
            dept_region_id = str(dept.region_id) if dept.region_id else None
            dept_language_id = str(dept.language_id) if dept.language_id else None
            org_settings = get_organization_regional_settings(db, dept.organization_id)
    elif user and user.organization_id:
        org_settings = get_organization_regional_settings(db, user.organization_id)

    # 3. Tenant settings
    tenant_settings = db.query(TenantRegionalSettings).filter(
        TenantRegionalSettings.tenant_id == tenant_id
    ).first()

    def _first(*values):
        return next((v for v in values if v is not None), None)

    return {
        "region_id": _first(
            str(user_settings.region_id) if user_settings and user_settings.region_id else None,
            dept_region_id,
            org_settings.get("region_id"),
            str(tenant_settings.region_id) if tenant_settings and tenant_settings.region_id else None,
        ),
        "language_id": _first(
            str(user_settings.language_id) if user_settings and user_settings.language_id else None,
            dept_language_id,
            org_settings.get("language_id"),
            str(tenant_settings.language_id) if tenant_settings and tenant_settings.language_id else None,
        ),
        "unit_display_settings": tenant_settings.unit_display_settings if tenant_settings else None,
    }


def get_department_subtree(db: Session, department_id: uuid.UUID) -> list[uuid.UUID]:
    """
    Returns UUIDs of the given department and all its children (recursive).
    Used for: 'show all assets in IT Division and all sub-departments'
    """
    result = db.execute(text("""
        WITH RECURSIVE dept_tree AS (
            SELECT id FROM departments WHERE id = :dept_id AND deleted_at IS NULL
            UNION ALL
            SELECT d.id FROM departments d
            JOIN dept_tree dt ON d.parent_id = dt.id
            WHERE d.deleted_at IS NULL
        )
        SELECT id FROM dept_tree
    """), {"dept_id": str(department_id)})
    return [row[0] for row in result]
