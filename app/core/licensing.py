"""
Inverum Fair-Use Offline Enterprise Licensing Verifier (Ed25519 RFC 8032).

Design Principles:
  - 100% Air-Gapped / Offline: Zero telemetry, zero external phone-home requests.
  - Cryptographic Verification: Verifies `INV-ENT-<payload_b64>.<sig_b64>` tokens
    against the embedded Ed25519 public key (`EMBEDDED_PUBLIC_KEY_PEM`).
  - Global Employee Seat Counting: Counts active employees (`deleted_at IS NULL AND is_active IS TRUE`)
    across ALL tenants (`SELECT count(*) FROM employees WHERE deleted_at IS NULL AND is_active IS TRUE`).
  - Zero Feature Lockouts (Soft Advisory Enforcement): Exceeding `max_employees` or running
    above the Community free threshold (`COMMUNITY_FREE_MAX_EMPLOYEES = 50`) without a valid
    Enterprise license key sets `banner_required = True`, displaying a non-blocking
    `<UnlicensedEnterpriseBanner />` in the UI without ever halting operations.
"""
from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from typing import Any

from Crypto.PublicKey import ECC
from Crypto.Signature import eddsa
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.system_config import SystemConfig

LICENSE_CONFIG_KEY = "enterprise_license_key"
COMMUNITY_FREE_MAX_EMPLOYEES = 50

# Official Inverum Ed25519 Public Key (corresponds to scripts/issue_license.py issuer key)
EMBEDDED_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA30vM1NPB3VWyQ6G7c0M7nZT9NFSP/Q87B/9d6oNtAWY=
-----END PUBLIC KEY-----"""


def _b64url_decode(segment: str) -> bytes:
    padded = segment + "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def verify_license_token(
    token: str,
    public_key_pem: str | None = None,
) -> dict[str, Any]:
    """
    Verify an `INV-ENT-<payload_b64>.<sig_b64>` offline license key using Ed25519 (RFC 8032).
    Returns a dictionary with parsed fields and validation flags.
    Raises ValueError if the format or cryptographic signature is invalid.
    """
    cleaned = (token or "").strip()
    if not cleaned.startswith("INV-ENT-"):
        raise ValueError("License key must start with 'INV-ENT-'.")

    body = cleaned[len("INV-ENT-") :]
    parts = body.split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError("Malformed license key structure (expected payload.signature).")

    try:
        payload_bytes = _b64url_decode(parts[0])
        signature_bytes = _b64url_decode(parts[1])
    except Exception as exc:
        raise ValueError(f"Invalid Base64URL encoding in license key: {exc}") from exc

    pem_to_use = public_key_pem or os.environ.get("INVERUM_LICENSE_PUBLIC_KEY_PEM") or EMBEDDED_PUBLIC_KEY_PEM
    pub_key = ECC.import_key(pem_to_use.strip())
    verifier = eddsa.new(pub_key, "rfc8032")

    try:
        verifier.verify(payload_bytes, signature_bytes)
    except ValueError as exc:
        raise ValueError("Cryptographic Ed25519 signature verification failed.") from exc

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Invalid JSON payload inside license key: {exc}") from exc

    required_fields = {"customer", "tier", "max_employees", "issued_at", "expires_at"}
    missing = required_fields - set(payload.keys())
    if missing:
        raise ValueError(f"License payload missing required fields: {sorted(missing)}")

    expires_at_str = str(payload["expires_at"])
    expires_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
    now_utc = datetime.now(timezone.utc)
    is_expired = now_utc > expires_dt

    return {
        "license_id": payload.get("license_id", "LIC-UNKNOWN"),
        "customer": str(payload["customer"]),
        "tier": str(payload["tier"]).lower(),
        "max_employees": int(payload["max_employees"]),
        "issued_at": str(payload["issued_at"]),
        "expires_at": expires_at_str,
        "issuer": payload.get("issuer", "Inverum Sovereign Open-Core Authority"),
        "signature_valid": True,
        "is_expired": is_expired,
    }


def count_active_employees_global(db: Session) -> int:
    """Count all non-deleted active employees across all tenants."""
    count = (
        db.query(func.count(Employee.id))
        .filter(Employee.deleted_at.is_(None), Employee.is_active.is_(True))
        .scalar()
    )
    return int(count or 0)


def get_system_license_status(db: Session) -> dict[str, Any]:
    """
    Evaluate the current system-wide license status against the active employee count.
    Never blocks system usage; sets `banner_required = True` when fair-use thresholds
    are exceeded or when a stored license has expired.
    """
    active_employees = count_active_employees_global(db)
    cfg = db.query(SystemConfig).filter(SystemConfig.key == LICENSE_CONFIG_KEY).first()
    raw_token = (cfg.value or "").strip() if cfg else ""

    if not raw_token:
        banner_required = active_employees > COMMUNITY_FREE_MAX_EMPLOYEES
        return {
            "is_licensed": not banner_required,
            "has_license_key": False,
            "signature_valid": False,
            "is_expired": False,
            "tier": "community",
            "customer": "Community Edition (Fair-Use Free Tier)",
            "license_id": None,
            "active_employees_count": active_employees,
            "max_employees": COMMUNITY_FREE_MAX_EMPLOYEES,
            "utilization_pct": round((active_employees / max(COMMUNITY_FREE_MAX_EMPLOYEES, 1)) * 100, 1),
            "issued_at": None,
            "expires_at": None,
            "banner_required": banner_required,
            "banner_reason": (
                f"Active employee count ({active_employees}) exceeds the Community Free Tier limit ({COMMUNITY_FREE_MAX_EMPLOYEES})."
                if banner_required
                else None
            ),
            "enforcement_mode": "fair-use-advisory",
        }

    try:
        verified = verify_license_token(raw_token)
    except ValueError as exc:
        return {
            "is_licensed": False,
            "has_license_key": True,
            "signature_valid": False,
            "is_expired": False,
            "tier": "unverified",
            "customer": "Invalid License Key",
            "license_id": None,
            "active_employees_count": active_employees,
            "max_employees": COMMUNITY_FREE_MAX_EMPLOYEES,
            "utilization_pct": round((active_employees / max(COMMUNITY_FREE_MAX_EMPLOYEES, 1)) * 100, 1),
            "issued_at": None,
            "expires_at": None,
            "banner_required": True,
            "banner_reason": str(exc),
            "enforcement_mode": "fair-use-advisory",
        }

    max_emp = verified["max_employees"]
    is_expired = verified["is_expired"]
    over_limit = active_employees > max_emp
    banner_required = is_expired or over_limit

    reason: str | None = None
    if is_expired:
        reason = f"Enterprise license for {verified['customer']} expired on {verified['expires_at'][:10]}."
    elif over_limit:
        reason = f"Active employee count ({active_employees}) exceeds licensed seat capacity ({max_emp})."

    return {
        "is_licensed": not banner_required,
        "has_license_key": True,
        "signature_valid": True,
        "is_expired": is_expired,
        "tier": verified["tier"],
        "customer": verified["customer"],
        "license_id": verified["license_id"],
        "active_employees_count": active_employees,
        "max_employees": max_emp,
        "utilization_pct": round((active_employees / max(max_emp, 1)) * 100, 1),
        "issued_at": verified["issued_at"],
        "expires_at": verified["expires_at"],
        "banner_required": banner_required,
        "banner_reason": reason,
        "enforcement_mode": "fair-use-advisory",
    }


def save_system_license_key(db: Session, license_key: str) -> dict[str, Any]:
    """
    Validate and store an `INV-ENT-...` license key in `system_config` (or clear it if empty).
    Raises ValueError if a non-empty key fails cryptographic Ed25519 verification.
    """
    cleaned = (license_key or "").strip()
    if cleaned:
        # Cryptographically verify before saving
        verify_license_token(cleaned)

    cfg = db.query(SystemConfig).filter(SystemConfig.key == LICENSE_CONFIG_KEY).first()
    if not cleaned:
        if cfg:
            db.delete(cfg)
            db.commit()
        return get_system_license_status(db)

    if cfg:
        cfg.value = cleaned
    else:
        cfg = SystemConfig(key=LICENSE_CONFIG_KEY, value=cleaned)
        db.add(cfg)
    db.commit()
    return get_system_license_status(db)
