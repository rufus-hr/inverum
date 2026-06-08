"""
Celery task: compute dashboard stats for all tenants and cache in Valkey.

Run by Celery Beat every 2 minutes so the API never waits for DB queries.
Fallback: if the API can't read from Valkey, it queries the DB directly.
"""
import json
import logging
from celery import shared_task
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.valkey import client as valkey
from app.models.asset import Asset
from app.models.data_audit_log import DataAuditLog
from app.models.asset_category import AssetCategory
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "dashboard:stats"
CACHE_TTL_SECONDS = 600  # 10 minuta — duže od beat intervala (2 min) da nikad ne istekne prirodno


@shared_task(
    name="compute_dashboard_stats",
    queue="inverum-worker-default",
    acks_late=True,
)
def compute_dashboard_stats():
    """
    Compute dashboard stats for every active tenant and store in Valkey.
    Runs every 2 minutes via Celery Beat.
    """
    if valkey is None:
        logger.warning("Valkey unavailable — skipping dashboard stats compute")
        return

    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        for tenant in tenants:
            try:
                stats = _compute_for_tenant(db, tenant.id)
                key = f"{CACHE_KEY_PREFIX}:{tenant.id}"
                valkey.setex(key, CACHE_TTL_SECONDS, json.dumps(stats, default=str))
            except Exception:
                logger.exception("Failed to compute stats for tenant %s", tenant.id)
        logger.info("Dashboard stats cached for %d tenants", len(tenants))
    finally:
        db.close()


def _compute_for_tenant(db: Session, tenant_id) -> dict:
    """Compute stats for a single tenant. Extracted so the API can use it as fallback."""

    total_assets = (
        db.query(func.count(Asset.id))
        .filter(Asset.tenant_id == tenant_id, Asset.deleted_at == None)
        .scalar()
    ) or 0

    status_rows = (
        db.query(Asset.status, func.count(Asset.id))
        .filter(Asset.tenant_id == tenant_id, Asset.deleted_at == None)
        .group_by(Asset.status)
        .all()
    )
    assets_by_status = {status: count for status, count in status_rows}

    type_rows = (
        db.query(AssetCategory.name, func.count(Asset.id))
        .join(Asset, Asset.category_id == AssetCategory.id)
        .filter(Asset.tenant_id == tenant_id, Asset.deleted_at == None)
        .group_by(AssetCategory.name)
        .all()
    )
    assets_by_type = {name or "Uncategorized": count for name, count in type_rows}

    uncategorized_count = (
        db.query(func.count(Asset.id))
        .filter(
            Asset.tenant_id == tenant_id,
            Asset.deleted_at == None,
            Asset.category_id == None,
        )
        .scalar()
    ) or 0
    if uncategorized_count:
        assets_by_type["Uncategorized"] = assets_by_type.get("Uncategorized", 0) + uncategorized_count

    recent = (
        db.query(DataAuditLog)
        .filter(DataAuditLog.tenant_id == tenant_id)
        .order_by(DataAuditLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        {
            "id": str(e.id),
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": str(e.entity_id),
            "actor_type": e.actor_type,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in recent
    ]

    return {
        "total_assets": total_assets,
        "assets_by_status": assets_by_status,
        "assets_by_type": assets_by_type,
        "recent_activity": recent_activity,
    }


def get_cached_stats(tenant_id) -> dict | None:
    """Read dashboard stats from Valkey cache. Returns None on miss or error."""
    if valkey is None:
        return None
    try:
        key = f"{CACHE_KEY_PREFIX}:{tenant_id}"
        raw = valkey.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        logger.exception("Failed to read dashboard cache for tenant %s", tenant_id)
    return None
