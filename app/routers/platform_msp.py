import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from app.core.valkey import get_valkey
from app.dependencies.auth import oauth2_scheme, user_has_permission
from app.dependencies.db import get_db
from app.models.accessory import Accessory
from app.models.asset import Asset
from app.models.consumable import Consumable
from app.models.location import Location
from app.models.manufacturer import Manufacturer
from app.models.platform_user import PlatformIdentity, PlatformUser
from app.models.stock_item import StockItem
from app.models.stock_policy import StockPolicy
from app.models.supply import Supply
from app.models.tenant import Tenant
from app.models.user import User, UserIdentity
from app.models.vendor import Vendor
from app.models.vendor_contract import VendorContract
from app.models.warranty import Warranty
from app.schemas.auth import TokenResponse
from app.services.pades_signer import sign_pdf_pades_lta
from app.services.reporting_service import build_deterministic_pdf

router = APIRouter(prefix="/platform", tags=["platform-msp"])


class PlatformLoginRequest(BaseModel):
    provider: str = "local"
    provider_id: str
    password: str


class PlatformActor(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str | None = None
    scope: str = "platform"


class ExportOrderRequest(BaseModel):
    format: str = Field(default="pdf", description="pdf | csv")
    days: int = Field(default=90, ge=1, le=730)
    tenant_id: uuid.UUID | None = None
    vendor_filter: str | None = None
    include_shortages: bool = True
    include_expiring: bool = True
    notes: str | None = None


def _create_platform_token(actor_id: uuid.UUID, token_type: str = "access") -> str:
    now = datetime.now(timezone.utc)
    exp = (
        now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        if token_type == "access"
        else now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    payload = {
        "sub": str(actor_id),
        "type": token_type,
        "scope": "platform",
        "tenant_id": None,
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def get_platform_actor(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> PlatformActor:
    """
    Authenticates either:
    1. A PlatformUser JWT (`scope == "platform"`), OR
    2. A tenant User JWT who has `platform:procurement` or `tenant:admin` permission.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("scope") == "platform":
        pu = db.query(PlatformUser).filter(
            PlatformUser.id == sub,
            PlatformUser.deleted_at.is_(None),
            PlatformUser.is_active.is_(True),
        ).first()
        if not pu:
            raise HTTPException(status_code=401, detail="Platform user not found or inactive")
        return PlatformActor(
            id=pu.id,
            display_name=pu.display_name,
            email=pu.email,
            scope="platform",
        )

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token scope")

    user = db.query(User).filter(
        User.id == sub,
        User.tenant_id == tenant_id,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")

    if not (
        user_has_permission(user, "platform:procurement", db)
        or user_has_permission(user, "tenant:admin", db)
        or user_has_permission(user, "tenant:settings", db)
    ):
        raise HTTPException(status_code=403, detail="Platform MSP permission required")

    return PlatformActor(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        scope="tenant_super_admin",
    )


@router.post("/auth/login", response_model=TokenResponse)
def platform_login(data: PlatformLoginRequest, db: Session = Depends(get_db)):
    identity = db.query(PlatformIdentity).filter(
        PlatformIdentity.provider == data.provider,
        PlatformIdentity.provider_id == data.provider_id,
        PlatformIdentity.deleted_at.is_(None),
    ).first()

    if identity:
        pw_hash = (identity.metadata_ or {}).get("password_hash")
        if not pw_hash or not bcrypt.checkpw(data.password.encode("utf-8"), pw_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid platform credentials")
        pu = identity.platform_user
        if not pu or not pu.is_active or pu.deleted_at is not None:
            raise HTTPException(status_code=401, detail="Platform user inactive")
        pu.last_login_at = datetime.now(timezone.utc)
        db.commit()
        access_token = _create_platform_token(pu.id, "access")
        refresh_token = _create_platform_token(pu.id, "refresh")
        vk = get_valkey()
        if vk is not None:
            vk.setex(f"platform_refresh:{pu.id}", 60 * 60 * 24 * 7, refresh_token)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    # Fallback: allow a tenant Super Admin identity to log in for platform scope if no PlatformIdentity matched
    user_identity = db.query(UserIdentity).filter(
        UserIdentity.provider == data.provider,
        UserIdentity.provider_id == data.provider_id,
        UserIdentity.deleted_at.is_(None),
    ).first()
    if not user_identity:
        raise HTTPException(status_code=401, detail="Invalid platform credentials")

    pw_hash = (user_identity.metadata_ or {}).get("password_hash")
    if not pw_hash or not bcrypt.checkpw(data.password.encode("utf-8"), pw_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid platform credentials")

    user = user_identity.user
    if not user or not user_has_permission(user, "tenant:settings", db):
        raise HTTPException(status_code=403, detail="User is not authorized for MSP Platform scope")

    # Auto-provision or fetch PlatformUser for this admin
    pu = db.query(PlatformUser).filter(PlatformUser.deleted_at.is_(None)).first()
    if not pu:
        pu = PlatformUser(display_name=user.display_name, email=user.email, is_active=True)
        db.add(pu)
        db.commit()
        db.refresh(pu)

    access_token = _create_platform_token(pu.id, "access")
    refresh_token = _create_platform_token(pu.id, "refresh")
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/tenants")
def list_platform_tenants(
    actor: PlatformActor = Depends(get_platform_actor),
    db: Session = Depends(get_db),
):
    tenants = db.query(Tenant).filter(
        Tenant.deleted_at.is_(None),
        Tenant.is_active.is_(True),
    ).order_by(Tenant.name.asc()).all()

    result = []
    for t in tenants:
        asset_count = db.query(Asset).filter(
            Asset.tenant_id == t.id,
            Asset.deleted_at.is_(None),
        ).count()
        contract_count = db.query(VendorContract).filter(
            VendorContract.tenant_id == t.id,
            VendorContract.deleted_at.is_(None),
        ).count()
        supply_count = db.query(Supply).filter(
            Supply.tenant_id == t.id,
            Supply.deleted_at.is_(None),
        ).count()
        result.append({
            "id": str(t.id),
            "name": t.name,
            "slug": t.slug,
            "asset_count": asset_count,
            "contract_count": contract_count,
            "supply_count": supply_count,
        })
    return {"items": result, "total": len(result)}


def _collect_expiring_data(
    db: Session,
    days: int = 90,
    tenant_id: uuid.UUID | None = None,
    vendor_filter: str | None = None,
) -> dict:
    today = date.today()
    cutoff = today + timedelta(days=days)
    past_grace = today - timedelta(days=90)  # include items expired in the last 90 days

    tenant_q = db.query(Tenant).filter(Tenant.deleted_at.is_(None), Tenant.is_active.is_(True))
    if tenant_id:
        tenant_q = tenant_q.filter(Tenant.id == tenant_id)
    tenants = {t.id: t for t in tenant_q.all()}
    if not tenants:
        return {"items": [], "by_vendor": [], "summary": {"total_items": 0, "warranties_count": 0, "contracts_count": 0, "eol_assets_count": 0, "total_estimated_value": 0.0, "tenants_affected": 0}}

    vendors = {
        v.id: v.name
        for v in db.query(Vendor).filter(Vendor.deleted_at.is_(None)).all()
    }
    assets_map = {
        a.id: a
        for a in db.query(Asset).filter(
            Asset.tenant_id.in_(tenants.keys()),
            Asset.deleted_at.is_(None),
        ).all()
    }

    items: list[dict] = []

    # 1. Warranties expiring within `days`
    warranties = db.query(Warranty).filter(
        Warranty.tenant_id.in_(tenants.keys()),
        Warranty.deleted_at.is_(None),
        Warranty.is_active.is_(True),
        Warranty.expires_at >= past_grace,
        Warranty.expires_at <= cutoff,
    ).order_by(Warranty.expires_at.asc()).all()

    for w in warranties:
        t = tenants.get(w.tenant_id)
        asset = assets_map.get(w.asset_id)
        v_name = vendors.get(w.vendor_id) or (vendors.get(asset.vendor_id) if asset else None) or "Unassigned Vendor"
        if vendor_filter and vendor_filter.lower() not in v_name.lower():
            continue
        days_rem = (w.expires_at - today).days
        est_val = float(asset.purchase_cost * Decimal("0.15")) if (asset and asset.purchase_cost) else 180.0
        items.append({
            "id": str(w.id),
            "item_type": "warranty",
            "tenant_id": str(w.tenant_id),
            "tenant_name": t.name if t else "Unknown",
            "tenant_slug": t.slug if t else "unknown",
            "title": f"{asset.name if asset else 'Asset'} ({w.warranty_type})",
            "reference_code": (asset.serial_number if asset else None) or w.contract_number or "—",
            "vendor_name": v_name,
            "support_level": w.support_level or "Standard",
            "expires_at": w.expires_at.isoformat(),
            "days_remaining": days_rem,
            "auto_renew": bool(w.auto_renew),
            "estimated_value": round(est_val, 2),
            "currency": (asset.purchase_currency if asset and asset.purchase_currency else "EUR"),
        })

    # 2. Vendor Contracts expiring within `days`
    contracts = db.query(VendorContract).filter(
        VendorContract.tenant_id.in_(tenants.keys()),
        VendorContract.deleted_at.is_(None),
        VendorContract.is_active.is_(True),
        VendorContract.end_date.is_not(None),
        VendorContract.end_date >= past_grace,
        VendorContract.end_date <= cutoff,
    ).order_by(VendorContract.end_date.asc()).all()

    for c in contracts:
        t = tenants.get(c.tenant_id)
        v_name = vendors.get(c.vendor_id) or "Unassigned Vendor"
        if vendor_filter and vendor_filter.lower() not in v_name.lower():
            continue
        days_rem = (c.end_date - today).days
        val = float(c.base_value or c.value or 0.0)
        items.append({
            "id": str(c.id),
            "item_type": "contract",
            "tenant_id": str(c.tenant_id),
            "tenant_name": t.name if t else "Unknown",
            "tenant_slug": t.slug if t else "unknown",
            "title": c.name,
            "reference_code": c.contract_number or c.contract_type,
            "vendor_name": v_name,
            "support_level": c.billing_cycle or c.contract_type,
            "expires_at": c.end_date.isoformat(),
            "days_remaining": days_rem,
            "auto_renew": bool(c.auto_renew),
            "estimated_value": round(val, 2),
            "currency": c.base_currency or c.currency or "EUR",
        })

    # 3. Assets approaching EoL (either explicit custom_fields['eol_date'] or 4-year lifecycle from purchase_date)
    for asset in assets_map.values():
        eol_date: date | None = None
        if isinstance(asset.custom_fields, dict) and asset.custom_fields.get("eol_date"):
            try:
                eol_date = date.fromisoformat(str(asset.custom_fields["eol_date"])[:10])
            except ValueError:
                eol_date = None
        elif asset.purchase_date:
            try:
                eol_date = asset.purchase_date.replace(year=asset.purchase_date.year + 4)
            except ValueError:
                eol_date = asset.purchase_date + timedelta(days=365 * 4)

        if not eol_date or not (past_grace <= eol_date <= cutoff):
            continue

        t = tenants.get(asset.tenant_id)
        v_name = vendors.get(asset.vendor_id) or vendors.get(asset.purchased_from_vendor_id) or "Hardware OEM"
        if vendor_filter and vendor_filter.lower() not in v_name.lower():
            continue
        days_rem = (eol_date - today).days
        replacement_val = float(asset.purchase_cost or 950.0)
        items.append({
            "id": str(asset.id),
            "item_type": "asset_eol",
            "tenant_id": str(asset.tenant_id),
            "tenant_name": t.name if t else "Unknown",
            "tenant_slug": t.slug if t else "unknown",
            "title": f"{asset.name or 'Hardware Asset'} (EoL Hardware Refresh)",
            "reference_code": asset.serial_number or "—",
            "vendor_name": v_name,
            "support_level": "Hardware Lifecycle (4Y)",
            "expires_at": eol_date.isoformat(),
            "days_remaining": days_rem,
            "auto_renew": False,
            "estimated_value": round(replacement_val, 2),
            "currency": asset.purchase_currency or "EUR",
        })

    items.sort(key=lambda x: x["days_remaining"])

    # Group by vendor & item_type
    grouped: dict[tuple[str, str], dict] = {}
    for it in items:
        key = (it["vendor_name"], it["item_type"])
        if key not in grouped:
            grouped[key] = {
                "vendor_name": it["vendor_name"],
                "item_type": it["item_type"],
                "total_count": 0,
                "tenants": set(),
                "total_estimated_value": 0.0,
                "currency": it["currency"],
            }
        grouped[key]["total_count"] += 1
        grouped[key]["tenants"].add(it["tenant_name"])
        grouped[key]["total_estimated_value"] = round(
            grouped[key]["total_estimated_value"] + it["estimated_value"], 2
        )

    by_vendor = [
        {
            "vendor_name": g["vendor_name"],
            "item_type": g["item_type"],
            "total_count": g["total_count"],
            "tenants_affected": sorted(g["tenants"]),
            "tenants_count": len(g["tenants"]),
            "total_estimated_value": g["total_estimated_value"],
            "currency": g["currency"],
        }
        for g in sorted(grouped.values(), key=lambda x: -x["total_estimated_value"])
    ]

    tenants_affected = len({it["tenant_id"] for it in items})
    return {
        "items": items,
        "by_vendor": by_vendor,
        "summary": {
            "total_items": len(items),
            "warranties_count": sum(1 for i in items if i["item_type"] == "warranty"),
            "contracts_count": sum(1 for i in items if i["item_type"] == "contract"),
            "eol_assets_count": sum(1 for i in items if i["item_type"] == "asset_eol"),
            "total_estimated_value": round(sum(i["estimated_value"] for i in items), 2),
            "tenants_affected": tenants_affected,
        },
    }


def _collect_shortages_data(
    db: Session,
    tenant_id: uuid.UUID | None = None,
    vendor_filter: str | None = None,
    include_all: bool = False,
) -> dict:
    tenant_q = db.query(Tenant).filter(Tenant.deleted_at.is_(None), Tenant.is_active.is_(True))
    if tenant_id:
        tenant_q = tenant_q.filter(Tenant.id == tenant_id)
    tenants = {t.id: t for t in tenant_q.all()}
    if not tenants:
        return {
            "consolidated_shortages": [],
            "summary": {
                "total_skus_short": 0,
                "total_units_to_order": 0,
                "total_estimated_cost": 0.0,
                "tenants_affected_count": 0,
            },
        }

    vendors = {
        v.id: v.name
        for v in db.query(Vendor).filter(Vendor.deleted_at.is_(None)).all()
    }
    manufacturers = {
        m.id: m.name
        for m in db.query(Manufacturer).filter(Manufacturer.deleted_at.is_(None)).all()
    }
    locations = {
        loc.id: loc.name
        for loc in db.query(Location).filter(Location.deleted_at.is_(None)).all()
    }

    supplies = db.query(Supply).filter(
        Supply.tenant_id.in_(tenants.keys()),
        Supply.deleted_at.is_(None),
        Supply.is_active.is_(True),
    ).all()

    policies = db.query(StockPolicy).filter(
        StockPolicy.tenant_id.in_(tenants.keys()),
        StockPolicy.deleted_at.is_(None),
        StockPolicy.is_active.is_(True),
    ).all()
    policies_by_supply: dict[uuid.UUID, list[StockPolicy]] = {}
    for p in policies:
        policies_by_supply.setdefault(p.supply_id, []).append(p)

    # Collect all stock instances across Consumable, StockItem, Accessory
    instances_by_supply: dict[uuid.UUID, list[dict]] = {}
    for entity_type, model, qty_attr in [
        ("consumable", Consumable, "current_quantity"),
        ("stock_item", StockItem, "quantity"),
        ("accessory", Accessory, "current_quantity"),
    ]:
        rows = db.query(model).filter(
            model.tenant_id.in_(tenants.keys()),
            model.deleted_at.is_(None),
        ).all()
        for r in rows:
            qty = getattr(r, qty_attr, 0) or 0
            min_qty = getattr(r, "minimum_quantity", None)
            instances_by_supply.setdefault(r.supply_id, []).append({
                "entity_type": entity_type,
                "location_id": r.location_id,
                "location_name": locations.get(r.location_id, "Central Warehouse"),
                "current_qty": qty,
                "min_qty": min_qty,
            })

    sku_groups: dict[str, dict] = {}

    for s in supplies:
        t = tenants.get(s.tenant_id)
        if not t:
            continue
        v_name = vendors.get(s.vendor_id) or "General IT Distributor"
        m_name = manufacturers.get(s.manufacturer_id) or "Generic OEM"
        if vendor_filter and (
            vendor_filter.lower() not in v_name.lower()
            and vendor_filter.lower() not in m_name.lower()
        ):
            continue

        s_instances = instances_by_supply.get(s.id, [])
        s_policies = policies_by_supply.get(s.id, [])

        total_curr = sum(i["current_qty"] for i in s_instances)
        inst_min = sum((i["min_qty"] or 0) for i in s_instances if i["min_qty"] is not None)
        pol_min = sum((p.minimum_quantity or 0) for p in s_policies if p.minimum_quantity is not None)
        pol_reorder = sum((p.reorder_quantity or 0) for p in s_policies if p.reorder_quantity is not None)

        effective_min = max(inst_min, pol_min)
        # If neither instance nor policy defines a minimum, default to 5 so MSP can see low-stock SKUs
        if effective_min == 0:
            effective_min = 5

        deficit = max(0, effective_min - total_curr)
        is_short = deficit > 0

        if not is_short and not include_all:
            continue

        reorder_qty = max(deficit, pol_reorder) if is_short else 0
        unit_price = float(s.unit_price or 25.0)
        currency = s.currency or "EUR"

        sku_key = (s.part_number or s.name).strip().upper()
        if sku_key not in sku_groups:
            sku_groups[sku_key] = {
                "sku_key": sku_key,
                "part_number": s.part_number or sku_key,
                "supply_name": s.name,
                "supply_type": s.supply_type,
                "category": s.category or "other",
                "manufacturer_name": m_name,
                "vendor_name": v_name,
                "unit": s.unit or "kom",
                "unit_price": round(unit_price, 2),
                "currency": currency,
                "total_current_qty": 0,
                "total_min_qty": 0,
                "total_deficit_qty": 0,
                "total_reorder_qty": 0,
                "estimated_order_cost": 0.0,
                "tenant_breakdown": [],
            }

        grp = sku_groups[sku_key]
        grp["total_current_qty"] += total_curr
        grp["total_min_qty"] += effective_min
        grp["total_deficit_qty"] += deficit
        grp["total_reorder_qty"] += reorder_qty
        grp["estimated_order_cost"] = round(
            grp["total_reorder_qty"] * grp["unit_price"], 2
        )
        loc_names = sorted({i["location_name"] for i in s_instances}) if s_instances else ["Unallocated Stock"]
        grp["tenant_breakdown"].append({
            "tenant_id": str(t.id),
            "tenant_name": t.name,
            "tenant_slug": t.slug,
            "supply_id": str(s.id),
            "locations": ", ".join(loc_names),
            "current_qty": total_curr,
            "min_qty": effective_min,
            "deficit_qty": deficit,
            "reorder_qty": reorder_qty,
            "estimated_cost": round(reorder_qty * grp["unit_price"], 2),
        })

    consolidated = sorted(
        sku_groups.values(),
        key=lambda g: (-g["total_deficit_qty"], -g["estimated_order_cost"]),
    )

    tenants_affected = {
        tb["tenant_id"]
        for g in consolidated
        for tb in g["tenant_breakdown"]
        if tb["deficit_qty"] > 0
    }

    return {
        "consolidated_shortages": consolidated,
        "summary": {
            "total_skus_short": sum(1 for g in consolidated if g["total_deficit_qty"] > 0),
            "total_units_to_order": sum(g["total_reorder_qty"] for g in consolidated),
            "total_estimated_cost": round(sum(g["estimated_order_cost"] for g in consolidated), 2),
            "tenants_affected_count": len(tenants_affected),
        },
    }


@router.get("/procurement/expiring")
def get_expiring_procurement(
    days: int = Query(default=90, ge=1, le=730),
    tenant_id: uuid.UUID | None = Query(default=None),
    vendor: str | None = Query(default=None),
    actor: PlatformActor = Depends(get_platform_actor),
    db: Session = Depends(get_db),
):
    return _collect_expiring_data(db, days=days, tenant_id=tenant_id, vendor_filter=vendor)


@router.get("/procurement/shortages")
def get_procurement_shortages(
    tenant_id: uuid.UUID | None = Query(default=None),
    vendor: str | None = Query(default=None),
    include_all: bool = Query(default=False),
    actor: PlatformActor = Depends(get_platform_actor),
    db: Session = Depends(get_db),
):
    return _collect_shortages_data(
        db,
        tenant_id=tenant_id,
        vendor_filter=vendor,
        include_all=include_all,
    )


MSP_PROCUREMENT_ORDER_HTML = """<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: sans-serif; color: #0f172a; font-size: 10px; line-height: 1.4; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 16px; font-weight: 700; letter-spacing: 0.4px; }
    .subtitle { font-size: 10px; color: #475569; margin-top: 2px; }
    .kpi-row { display: flex; gap: 10px; margin-bottom: 14px; }
    .kpi { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #f8fafc; }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 15px; font-weight: 700; margin-top: 2px; }
    h3 { font-size: 12px; margin: 12px 0 6px 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 5px 6px; font-size: 9px; text-transform: uppercase; }
    td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; font-size: 9.5px; }
    .right { text-align: right; }
    .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">KONSOLIDIRANA MSP NARUDŽBENICA (CROSS-TENANT PROCUREMENT)</div>
      <div class="subtitle">Skupna nabava zaliha, produljenja garancija/ugovora i zamjene EoL opreme kroz sve klijente</div>
    </div>
    <div style="text-align: right;">
      <div><strong>Broj narudžbenice:</strong> {{ order_number }}</div>
      <div><strong>Datum izdavanja:</strong> {{ generated_at }}</div>
      <div><strong>Izdao (MSP):</strong> {{ actor_name }}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-label">SKU Stavki za narudžbu</div>
      <div class="kpi-val">{{ shortages_summary.total_skus_short }} ({{ shortages_summary.total_units_to_order }} kom)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Vrijednost narudžbe zaliha</div>
      <div class="kpi-val">{{ "%.2f"|format(shortages_summary.total_estimated_cost) }} EUR</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Garancije / Ugovori / EoL ({{ days }}d)</div>
      <div class="kpi-val">{{ expiring_summary.total_items }} stavki</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Procijenjena vrijednost obnove</div>
      <div class="kpi-val">{{ "%.2f"|format(expiring_summary.total_estimated_value) }} EUR</div>
    </div>
  </div>

  {% if shortages %}
  <h3>1. Skupna narudžba potrošnog materijala i pričuvnih dijelova (po Part Numberu / Distributeru)</h3>
  <table>
    <thead>
      <tr>
        <th>Part Number (SKU)</th>
        <th>Naziv artikla</th>
        <th>Proizvođač / Distributer</th>
        <th>Klijenti (Tenanti)</th>
        <th class="right">Trenutno</th>
        <th class="right">Minimum</th>
        <th class="right">Za naručiti</th>
        <th class="right">Jed. cijena</th>
        <th class="right">Ukupno (EUR)</th>
      </tr>
    </thead>
    <tbody>
      {% for s in shortages %}
      <tr>
        <td><strong>{{ s.part_number }}</strong></td>
        <td>{{ s.supply_name }} ({{ s.supply_type }})</td>
        <td>{{ s.manufacturer_name }} / {{ s.vendor_name }}</td>
        <td>
          {% for tb in s.tenant_breakdown %}
            {{ tb.tenant_name }} ({{ tb.reorder_qty }} {{ s.unit }}){% if not loop.last %}, {% endif %}
          {% endfor %}
        </td>
        <td class="right">{{ s.total_current_qty }} {{ s.unit }}</td>
        <td class="right">{{ s.total_min_qty }} {{ s.unit }}</td>
        <td class="right"><strong>{{ s.total_reorder_qty }} {{ s.unit }}</strong></td>
        <td class="right">{{ "%.2f"|format(s.unit_price) }}</td>
        <td class="right"><strong>{{ "%.2f"|format(s.estimated_order_cost) }}</strong></td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
  {% endif %}

  {% if expiring %}
  <h3>2. Plan obnove garancija, ugovora i EoL opreme (idućih {{ days }} dana)</h3>
  <table>
    <thead>
      <tr>
        <th>Klijent (Tenant)</th>
        <th>Vrsta stavke</th>
        <th>Naziv / Opis</th>
        <th>Referenca / S/N</th>
        <th>Dobavljač (Vendor)</th>
        <th>Datum isteka</th>
        <th class="right">Preostalo dana</th>
        <th class="right">Procjena (EUR)</th>
      </tr>
    </thead>
    <tbody>
      {% for item in expiring %}
      <tr>
        <td><strong>{{ item.tenant_name }}</strong></td>
        <td>{{ item.item_type|upper }}</td>
        <td>{{ item.title }}</td>
        <td>{{ item.reference_code }}</td>
        <td>{{ item.vendor_name }}</td>
        <td>{{ item.expires_at }}</td>
        <td class="right">{{ item.days_remaining }} d</td>
        <td class="right">{{ "%.2f"|format(item.estimated_value) }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
  {% endif %}

  {% if notes %}
  <div style="margin-top: 8px; padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc;">
    <strong>Napomena uz narudžbenicu:</strong> {{ notes }}
  </div>
  {% endif %}

  <div class="footer">
    <div>Inverum MSP Cross-Tenant Procurement Engine · ISO/IEC 27001 A.5.19 &amp; A.8.14</div>
    <div>Kriptografski potpisano: <strong>eIDAS PAdES-B-LTA (RFC 3161 TSA)</strong></div>
  </div>
</body>
</html>
"""


@router.post("/procurement/export-order")
def export_consolidated_order(
    payload: ExportOrderRequest,
    actor: PlatformActor = Depends(get_platform_actor),
    db: Session = Depends(get_db),
):
    shortages_data = (
        _collect_shortages_data(db, tenant_id=payload.tenant_id, vendor_filter=payload.vendor_filter)
        if payload.include_shortages
        else {"consolidated_shortages": [], "summary": {"total_skus_short": 0, "total_units_to_order": 0, "total_estimated_cost": 0.0, "tenants_affected_count": 0}}
    )
    expiring_data = (
        _collect_expiring_data(db, days=payload.days, tenant_id=payload.tenant_id, vendor_filter=payload.vendor_filter)
        if payload.include_expiring
        else {"items": [], "by_vendor": [], "summary": {"total_items": 0, "warranties_count": 0, "contracts_count": 0, "eol_assets_count": 0, "total_estimated_value": 0.0, "tenants_affected": 0}}
    )

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    order_no = f"PO-MSP-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"

    if payload.format.lower() == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "SECTION",
            "PART_NUMBER_OR_REF",
            "TITLE",
            "CATEGORY_TYPE",
            "VENDOR",
            "MANUFACTURER",
            "TENANTS_BREAKDOWN",
            "QTY_OR_DAYS_REMAINING",
            "UNIT_PRICE_EUR",
            "TOTAL_ESTIMATED_EUR",
        ])
        for s in shortages_data["consolidated_shortages"]:
            tb_str = "; ".join(
                f"{tb['tenant_name']}: {tb['reorder_qty']} {s['unit']}"
                for tb in s["tenant_breakdown"]
            )
            writer.writerow([
                "STOCK_SHORTAGE",
                s["part_number"],
                s["supply_name"],
                s["supply_type"],
                s["vendor_name"],
                s["manufacturer_name"],
                tb_str,
                s["total_reorder_qty"],
                f"{s['unit_price']:.2f}",
                f"{s['estimated_order_cost']:.2f}",
            ])
        for item in expiring_data["items"]:
            writer.writerow([
                f"EXPIRING_{item['item_type'].upper()}",
                item["reference_code"],
                item["title"],
                item["item_type"],
                item["vendor_name"],
                "—",
                item["tenant_name"],
                f"{item['days_remaining']} days ({item['expires_at']})",
                f"{item['estimated_value']:.2f}",
                f"{item['estimated_value']:.2f}",
            ])
        csv_bytes = buf.getvalue().encode("utf-8-sig")
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{order_no}.csv"',
            },
        )

    # Default: render deterministic PDF and PAdES-B-LTA sign
    s_sum = shortages_data["summary"]
    e_sum = expiring_data["summary"]
    meta_lines = [
        ("Order Number", order_no),
        ("Generated At", now_str),
        ("Issued By (MSP)", actor.display_name),
        ("Stock Shortages", f"{s_sum['total_skus_short']} SKUs ({s_sum['total_units_to_order']} units) — {s_sum['total_estimated_cost']:.2f} EUR"),
        (f"Expiring Renewals ({payload.days}d)", f"{e_sum['total_items']} items — {e_sum['total_estimated_value']:.2f} EUR"),
    ]
    if payload.notes:
        meta_lines.append(("Notes", payload.notes[:80]))

    headers = ["Type / SKU", "Description & Vendor", "Tenants / Breakdown", "Qty / Horizon", "Est. EUR"]
    rows: list[list[str]] = []
    for s in shortages_data["consolidated_shortages"][:40]:
        tb_str = ", ".join(
            f"{tb['tenant_name']} ({tb['reorder_qty']})"
            for tb in s["tenant_breakdown"]
        )
        rows.append([
            f"SKU: {s['part_number'][:18]}",
            f"{s['supply_name'][:22]} ({s['vendor_name'][:14]})",
            tb_str[:28],
            f"{s['total_reorder_qty']} {s['unit']}",
            f"{s['estimated_order_cost']:.2f}",
        ])
    for item in expiring_data["items"][:40]:
        rows.append([
            f"{item['item_type'].upper()[:6]}: {item['reference_code'][:12]}",
            f"{item['title'][:22]} ({item['vendor_name'][:14]})",
            item["tenant_name"][:28],
            f"{item['days_remaining']}d ({item['expires_at']})",
            f"{item['estimated_value']:.2f}",
        ])
    if not rows:
        rows.append(["—", "No shortages or expiring items in selected filter", "—", "0", "0.00"])

    raw_pdf = build_deterministic_pdf(
        title=f"KONSOLIDIRANA MSP NARUDZBENICA — {order_no}",
        subtitle="ISO/IEC 27001:2022 (A.5.19 Supplier Security, A.8.14 Redundancy & Spares)  |  eIDAS PAdES-B-LTA",
        meta_lines=meta_lines,
        headers=headers,
        rows=rows,
    )
    signed_res = sign_pdf_pades_lta(
        pdf_bytes=raw_pdf,
        tenant_id=str(payload.tenant_id or actor.id),
        legal_entity_name="Inverum MSP Platform",
        signer_name=actor.display_name,
        reason=f"MSP Consolidated Purchase Order {order_no}",
    )
    return Response(
        content=signed_res.pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{order_no}-signed.pdf"',
            "X-Document-SHA256": signed_res.sha256_hash,
            "Access-Control-Expose-Headers": "Content-Disposition, X-Document-SHA256",
        },
    )
