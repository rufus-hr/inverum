"""
Dashboard stats endpoint.

Architecture:
- Celery Beat runs `compute_dashboard_stats` every 2 min → stores in Valkey.
- API reads from Valkey first (instant, no DB query).
- On cache miss or Valkey unavailable, falls back to direct DB query (slow but works).

This means the dashboard is always fast — never more than 2 min stale.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.tasks.dashboard_stats import get_cached_stats, _compute_for_tenant

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

    # 1. Try Valkey cache (instant)
    cached = get_cached_stats(tenant_id)
    if cached is not None:
        return DashboardStatsResponse(**cached)

    # 2. Fallback: compute from DB (slow, but works when Valkey is down)
    stats = _compute_for_tenant(db, tenant_id)
    return DashboardStatsResponse(**stats)
