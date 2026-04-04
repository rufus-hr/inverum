import uuid
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_contact import VendorContact
from app.models.asset import Asset
from app.models.vendor_contract import VendorContract
from app.models.work_order import WorkOrder
from app.schemas.vendor import VendorCreate, VendorModify, VendorResponse, VendorStatsResponse
from app.schemas.vendor_contact import VendorContactCreate, VendorContactModify, VendorContactResponse
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("/", response_model=PagedResponse[VendorResponse])
def list_vendors(
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("vendor:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Vendor).filter(
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    )
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:read")),
    db: Session = Depends(get_db),
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


@router.post("/", response_model=VendorResponse, status_code=201)
def create_vendor(
    data: VendorCreate,
    user: User = Depends(require_permission("vendor:write")),
    db: Session = Depends(get_db),
):
    v = Vendor(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: uuid.UUID,
    data: VendorModify,
    user: User = Depends(require_permission("vendor:write")),
    db: Session = Depends(get_db),
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(v, field, value)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vendor_id}", status_code=204)
def delete_vendor(
    vendor_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:delete")),
    db: Session = Depends(get_db),
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == user.tenant_id,
        Vendor.deleted_at == None,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    v.deleted_at = datetime.now(timezone.utc)
    db.commit()


# --- Contacts ---

@router.get("/{vendor_id}/contacts", response_model=list[VendorContactResponse])
def list_contacts(
    vendor_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:read")),
    db: Session = Depends(get_db),
):
    _get_vendor_or_404(vendor_id, user.tenant_id, db)
    return db.query(VendorContact).filter(
        VendorContact.vendor_id == vendor_id,
        VendorContact.tenant_id == user.tenant_id,
        VendorContact.deleted_at == None,
    ).all()


@router.post("/{vendor_id}/contacts", response_model=VendorContactResponse, status_code=201)
def add_contact(
    vendor_id: uuid.UUID,
    data: VendorContactCreate,
    user: User = Depends(require_permission("vendor:write")),
    db: Session = Depends(get_db),
):
    _get_vendor_or_404(vendor_id, user.tenant_id, db)
    if data.is_primary:
        # demote existing primary
        db.query(VendorContact).filter(
            VendorContact.vendor_id == vendor_id,
            VendorContact.tenant_id == user.tenant_id,
            VendorContact.is_primary == True,
            VendorContact.deleted_at == None,
        ).update({"is_primary": False})
    c = VendorContact(**data.model_dump(), vendor_id=vendor_id, tenant_id=user.tenant_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/{vendor_id}/contacts/{contact_id}", response_model=VendorContactResponse)
def update_contact(
    vendor_id: uuid.UUID,
    contact_id: uuid.UUID,
    data: VendorContactModify,
    user: User = Depends(require_permission("vendor:write")),
    db: Session = Depends(get_db),
):
    c = _get_contact_or_404(contact_id, vendor_id, user.tenant_id, db)
    if data.is_primary:
        db.query(VendorContact).filter(
            VendorContact.vendor_id == vendor_id,
            VendorContact.tenant_id == user.tenant_id,
            VendorContact.is_primary == True,
            VendorContact.deleted_at == None,
            VendorContact.id != contact_id,
        ).update({"is_primary": False})
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{vendor_id}/contacts/{contact_id}", status_code=204)
def delete_contact(
    vendor_id: uuid.UUID,
    contact_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:write")),
    db: Session = Depends(get_db),
):
    c = _get_contact_or_404(contact_id, vendor_id, user.tenant_id, db)
    c.deleted_at = datetime.now(timezone.utc)
    db.commit()


# --- Stats ---

@router.get("/{vendor_id}/stats", response_model=VendorStatsResponse)
def vendor_stats(
    vendor_id: uuid.UUID,
    user: User = Depends(require_permission("vendor:read")),
    db: Session = Depends(get_db),
):
    v = _get_vendor_or_404(vendor_id, user.tenant_id, db)

    assets = db.query(Asset).filter(
        Asset.purchased_from_vendor_id == vendor_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).all()

    total_value = sum(
        float(a.purchase_cost) for a in assets if a.purchase_cost is not None
    ) or None
    currency = next((a.purchase_currency for a in assets if a.purchase_currency), None)

    assets_by_status: dict = {}
    for a in assets:
        assets_by_status[a.status] = assets_by_status.get(a.status, 0) + 1

    contracts = db.query(VendorContract).filter(
        VendorContract.vendor_id == vendor_id,
        VendorContract.tenant_id == user.tenant_id,
        VendorContract.is_active == True,
        VendorContract.deleted_at == None,
    ).all()

    active_contracts = len(contracts)
    expiry_threshold = date.today() + timedelta(days=90)
    expiring_90d = sum(
        1 for c in contracts
        if c.end_date and c.end_date <= expiry_threshold
    )

    asset_ids = [a.id for a in assets]
    work_orders = db.query(WorkOrder).filter(
        WorkOrder.asset_id.in_(asset_ids),
        WorkOrder.tenant_id == user.tenant_id,
        WorkOrder.deleted_at == None,
    ).all() if asset_ids else []

    wo_open = sum(1 for wo in work_orders if wo.status in ("open", "in_progress"))

    completed_wos = [wo for wo in work_orders
                     if wo.status == "completed" and wo.scheduled_at and wo.completed_at]
    avg_repair = None
    if completed_wos:
        avg_repair = sum(
            (wo.completed_at - wo.scheduled_at).days for wo in completed_wos
        ) / len(completed_wos)

    return VendorStatsResponse(
        vendor_id=v.id,
        vendor_name=v.name,
        total_assets=len(assets),
        total_purchase_value=total_value,
        currency=currency,
        assets_by_status=assets_by_status,
        active_contracts=active_contracts,
        expiring_contracts_90d=expiring_90d,
        work_orders_total=len(work_orders),
        work_orders_open=wo_open,
        avg_repair_days=avg_repair,
    )


def _get_vendor_or_404(vendor_id: uuid.UUID, tenant_id: uuid.UUID, db: Session) -> Vendor:
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id, Vendor.tenant_id == tenant_id, Vendor.deleted_at == None
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


def _get_contact_or_404(contact_id, vendor_id, tenant_id, db) -> VendorContact:
    c = db.query(VendorContact).filter(
        VendorContact.id == contact_id,
        VendorContact.vendor_id == vendor_id,
        VendorContact.tenant_id == tenant_id,
        VendorContact.deleted_at == None,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    return c
