from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.asset import Asset
from app.models.data_audit_log import DataAuditLog
from app.models.asset_category import AssetCategory

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStatsResponse(BaseModel):
    total_assets: int
    assets_by_status: dict[str, int]
    assets_by_type: dict[str, int]
    recent_activity: list[dict]


@router.get("/stats", response_model=DashboardStatsResponse)
def dashboard_stats(
    user: User = Depends(require_permission("asset:read")),
    db: Session = Depends(get_db),
):
    tenant_id = user.tenant_id

    # Total assets (non-deleted)
    total_assets = (
        db.query(func.count(Asset.id))
        .filter(Asset.tenant_id == tenant_id, Asset.deleted_at == None)
        .scalar()
    )

    # Assets by status
    status_rows = (
        db.query(Asset.status, func.count(Asset.id))
        .filter(Asset.tenant_id == tenant_id, Asset.deleted_at == None)
        .group_by(Asset.status)
        .all()
    )
    assets_by_status = {status: count for status, count in status_rows}

    # Assets by type (category name)
    type_rows = (
        db.query(AssetCategory.name, func.count(Asset.id))
        .join(Asset, Asset.category_id == AssetCategory.id)
        .filter(Asset.tenant_id == tenant_id, Asset.deleted_at == None)
        .group_by(AssetCategory.name)
        .all()
    )
    assets_by_type = {name or "Uncategorized": count for name, count in type_rows}

    # Add uncategorized assets
    uncategorized_count = (
        db.query(func.count(Asset.id))
        .filter(
            Asset.tenant_id == tenant_id,
            Asset.deleted_at == None,
            Asset.category_id == None,
        )
        .scalar()
    )
    if uncategorized_count:
        assets_by_type["Uncategorized"] = uncategorized_count

    # Recent activity (last 10 audit entries)
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

    return DashboardStatsResponse(
        total_assets=total_assets or 0,
        assets_by_status=assets_by_status,
        assets_by_type=assets_by_type,
        recent_activity=recent_activity,
    )
