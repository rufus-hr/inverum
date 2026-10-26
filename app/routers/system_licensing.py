"""
System Licensing Router (`/api/v1/system/license-status` & `/api/v1/system/license`).

Provides 100% offline Ed25519 license verification and seat utilization monitoring
across all tenants without telemetry or feature lockouts.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.core.licensing import get_system_license_status, save_system_license_key
from app.models.user import User

router = APIRouter(prefix="/system", tags=["System Licensing"])


class LicenseUpdateRequest(BaseModel):
    license_key: str = Field(
        default="",
        description="Ed25519 signed offline license key (INV-ENT-<payload>.<signature>) or empty string to reset to Community Tier.",
    )


@router.get("/license-status")
def read_license_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the current offline Ed25519 license status and global active employee seat count.
    """
    return get_system_license_status(db)


@router.put("/license")
def update_license_key(
    payload: LicenseUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify and store an Ed25519 offline Enterprise license key (`INV-ENT-...`) in `system_config`.
    """
    try:
        return save_system_license_key(db, payload.license_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
