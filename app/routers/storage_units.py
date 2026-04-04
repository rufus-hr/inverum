import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.asset import Asset
from app.models.box import Box
from app.models.storage_unit import StorageUnit
from app.schemas.storage_unit import (
    StorageUnitCreate, StorageUnitModify, StorageUnitResponse,
    PlaceInStorageUnit, AssetLocationResponse, BreadcrumbItem,
)
from app.schemas.pagination import PagedResponse
from app.dependencies.pagination import PaginationParams
from app.services import event_bus_service

router = APIRouter(prefix="/storage-units", tags=["storage-units"])


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=PagedResponse[StorageUnitResponse])
def list_storage_units(
    location_id: uuid.UUID | None = None,
    type: str | None = None,
    security_level_min: int | None = None,
    is_lockable: bool | None = None,
    pagination: PaginationParams = Depends(PaginationParams),
    user: User = Depends(require_permission("storage_unit:read")),
    db: Session = Depends(get_db),
):
    query = db.query(StorageUnit).filter(
        StorageUnit.tenant_id == user.tenant_id,
        StorageUnit.deleted_at == None,
    )
    if location_id:
        query = query.filter(StorageUnit.location_id == location_id)
    if type:
        query = query.filter(StorageUnit.type == type)
    if security_level_min is not None:
        query = query.filter(StorageUnit.security_level >= security_level_min)
    if is_lockable is not None:
        query = query.filter(StorageUnit.is_lockable == is_lockable)
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    pages = (total + pagination.limit - 1) // pagination.limit
    return PagedResponse(items=items, total=total, page=pagination.page,
                         limit=pagination.limit, pages=pages)


@router.post("/", response_model=StorageUnitResponse, status_code=201)
def create_storage_unit(
    data: StorageUnitCreate,
    user: User = Depends(require_permission("storage_unit:write")),
    db: Session = Depends(get_db),
):
    su = StorageUnit(**data.model_dump(), tenant_id=user.tenant_id)
    db.add(su)
    db.commit()
    db.refresh(su)
    return su


@router.get("/{su_id}", response_model=StorageUnitResponse)
def get_storage_unit(
    su_id: uuid.UUID,
    user: User = Depends(require_permission("storage_unit:read")),
    db: Session = Depends(get_db),
):
    su = _get_or_404(su_id, user.tenant_id, db)
    return su


@router.put("/{su_id}", response_model=StorageUnitResponse)
def update_storage_unit(
    su_id: uuid.UUID,
    data: StorageUnitModify,
    user: User = Depends(require_permission("storage_unit:write")),
    db: Session = Depends(get_db),
):
    su = _get_or_404(su_id, user.tenant_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(su, field, value)
    db.commit()
    db.refresh(su)
    return su


@router.delete("/{su_id}", status_code=204)
def delete_storage_unit(
    su_id: uuid.UUID,
    user: User = Depends(require_permission("storage_unit:delete")),
    db: Session = Depends(get_db),
):
    su = _get_or_404(su_id, user.tenant_id, db)
    su.deleted_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Contents — direktni sadržaj storage unita
# ---------------------------------------------------------------------------

@router.get("/{su_id}/contents")
def get_storage_unit_contents(
    su_id: uuid.UUID,
    user: User = Depends(require_permission("storage_unit:read")),
    db: Session = Depends(get_db),
):
    su = _get_or_404(su_id, user.tenant_id, db)

    children = db.query(StorageUnit).filter(
        StorageUnit.parent_storage_unit_id == su_id,
        StorageUnit.tenant_id == user.tenant_id,
        StorageUnit.deleted_at == None,
    ).all()

    assets = db.query(Asset).filter(
        Asset.storage_unit_id == su_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).all()

    boxes = db.query(Box).filter(
        Box.storage_unit_id == su_id,
        Box.tenant_id == user.tenant_id,
        Box.deleted_at == None,
    ).all()

    # Security violations: asset.security_level > storage_unit.security_level
    violations = [
        {
            "asset_id": str(a.id),
            "asset_security_level": a.security_level,
            "storage_unit_security_level": su.security_level,
            "message": "High-value asset in storage unit with insufficient security level",
        }
        for a in assets if a.security_level > su.security_level
    ]

    return {
        "storage_unit": {
            "id": str(su.id),
            "name": su.name,
            "type": su.type,
            "security_level": su.security_level,
            "is_lockable": su.is_lockable,
            "location_id": str(su.location_id),
        },
        "children": [
            {"type": "storage_unit", "id": str(c.id), "name": c.name,
             "security_level": c.security_level}
            for c in children
        ],
        "assets": [
            {"id": str(a.id), "name": a.name, "status_id": str(a.status_id) if a.status_id else None,
             "security_level": a.security_level}
            for a in assets
        ],
        "boxes": [
            {"id": str(b.id), "inventory_number": b.inventory_number, "status": b.status}
            for b in boxes
        ],
        "security_violations": violations,
    }


# ---------------------------------------------------------------------------
# Tree — rekurzivno stablo
# ---------------------------------------------------------------------------

@router.get("/{su_id}/tree")
def get_storage_unit_tree(
    su_id: uuid.UUID,
    user: User = Depends(require_permission("storage_unit:read")),
    db: Session = Depends(get_db),
):
    _get_or_404(su_id, user.tenant_id, db)

    rows = db.execute(text("""
        WITH RECURSIVE tree AS (
            SELECT id, name, type, security_level, is_lockable, capacity,
                   parent_storage_unit_id, location_id, 0 AS depth
            FROM storage_units
            WHERE id = :root_id AND tenant_id = :tenant_id AND deleted_at IS NULL

            UNION ALL

            SELECT su.id, su.name, su.type, su.security_level, su.is_lockable, su.capacity,
                   su.parent_storage_unit_id, su.location_id, t.depth + 1
            FROM storage_units su
            JOIN tree t ON su.parent_storage_unit_id = t.id
            WHERE su.deleted_at IS NULL
        )
        SELECT * FROM tree ORDER BY depth, name
    """), {"root_id": su_id, "tenant_id": user.tenant_id}).mappings().all()

    return {"nodes": [dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# Place asset in storage unit
# ---------------------------------------------------------------------------

asset_router = APIRouter(prefix="/assets", tags=["storage-units"])


@asset_router.post("/{asset_id}/place")
def place_asset(
    asset_id: uuid.UUID,
    data: PlaceInStorageUnit,
    user: User = Depends(require_permission("asset:write")),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    su = db.query(StorageUnit).filter(
        StorageUnit.id == data.storage_unit_id,
        StorageUnit.tenant_id == user.tenant_id,
        StorageUnit.deleted_at == None,
    ).first()
    if not su:
        raise HTTPException(status_code=404, detail="Storage unit not found")

    # Promijeni parent — isključi ostale
    asset.location_id = None
    asset.box_id = None
    asset.storage_unit_id = su.id

    warning = None
    if asset.security_level > su.security_level:
        event_bus_service.publish(
            db=db,
            tenant_id=user.tenant_id,
            event_type="security_placement_violation",
            entity_type="asset",
            entity_id=asset.id,
            payload={
                "asset_security_level": asset.security_level,
                "storage_unit_security_level": su.security_level,
                "storage_unit_id": str(su.id),
                "storage_unit_name": su.name,
            },
        )
        warning = {
            "code": "security_placement_violation",
            "message": f"Asset security level ({asset.security_level}) exceeds storage unit security level ({su.security_level})",
        }

    db.commit()

    response = {"status": "ok", "storage_unit_id": str(su.id)}
    if warning:
        response["warning"] = warning
    return response


@asset_router.post("/{asset_id}/place-in-location")
def place_asset_in_location(
    asset_id: uuid.UUID,
    location_id: uuid.UUID,
    user: User = Depends(require_permission("asset:write")),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.storage_unit_id = None
    asset.box_id = None
    asset.location_id = location_id
    db.commit()
    return {"status": "ok", "location_id": str(location_id)}


# ---------------------------------------------------------------------------
# Breadcrumb / effective location
# ---------------------------------------------------------------------------

@asset_router.get("/{asset_id}/location", response_model=AssetLocationResponse)
def get_asset_location(
    asset_id: uuid.UUID,
    user: User = Depends(require_permission("asset:read")),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
        Asset.deleted_at == None,
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    breadcrumb = _build_breadcrumb(asset, db)

    # Determine direct parent type
    if asset.location_id:
        direct_type = "location"
        direct_id = asset.location_id
    elif asset.storage_unit_id:
        direct_type = "storage_unit"
        direct_id = asset.storage_unit_id
    elif asset.box_id:
        direct_type = "box"
        direct_id = asset.box_id
    else:
        direct_type = "unknown"
        direct_id = asset.id

    # Effective location = first location type in breadcrumb
    eff_loc = next((b for b in breadcrumb if b.type == "location"), None)

    # Check in_transit
    in_transit = False
    if asset.box_id:
        box = db.query(Box).filter(Box.id == asset.box_id).first()
        if box and box.status == "in_transit":
            in_transit = True

    return AssetLocationResponse(
        asset_id=asset.id,
        direct_parent_type=direct_type,
        direct_parent_id=direct_id,
        effective_location_id=eff_loc.id if eff_loc else None,
        effective_location_name=eff_loc.name if eff_loc else None,
        breadcrumb=breadcrumb,
        in_transit=in_transit,
    )


# ---------------------------------------------------------------------------
# Box placement in storage unit
# ---------------------------------------------------------------------------

box_router = APIRouter(prefix="/boxes", tags=["storage-units"])


@box_router.post("/{box_id}/place")
def place_box(
    box_id: uuid.UUID,
    data: PlaceInStorageUnit,
    user: User = Depends(require_permission("asset:write")),
    db: Session = Depends(get_db),
):
    box = db.query(Box).filter(
        Box.id == box_id,
        Box.tenant_id == user.tenant_id,
        Box.deleted_at == None,
    ).first()
    if not box:
        raise HTTPException(status_code=404, detail="Box not found")

    su = db.query(StorageUnit).filter(
        StorageUnit.id == data.storage_unit_id,
        StorageUnit.tenant_id == user.tenant_id,
        StorageUnit.deleted_at == None,
    ).first()
    if not su:
        raise HTTPException(status_code=404, detail="Storage unit not found")

    box.location_id = None
    box.parent_box_id = None
    box.storage_unit_id = su.id
    db.commit()
    return {"status": "ok", "storage_unit_id": str(su.id)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_404(su_id: uuid.UUID, tenant_id: uuid.UUID, db: Session) -> StorageUnit:
    su = db.query(StorageUnit).filter(
        StorageUnit.id == su_id,
        StorageUnit.tenant_id == tenant_id,
        StorageUnit.deleted_at == None,
    ).first()
    if not su:
        raise HTTPException(status_code=404, detail="Storage unit not found")
    return su


def _build_breadcrumb(asset: Asset, db: Session) -> list[BreadcrumbItem]:
    """
    Walk up the hierarchy (box → storage_unit → location) and return breadcrumb list
    from root (location) down to the asset.
    """
    from app.models.location import Location

    crumbs: list[BreadcrumbItem] = []

    # Collect path by walking up
    path: list[BreadcrumbItem] = []

    # Start from direct parent
    current_box_id = asset.box_id
    current_su_id = asset.storage_unit_id
    current_loc_id = asset.location_id

    visited = set()  # guard against cycles

    while True:
        if current_loc_id:
            loc = db.query(Location).filter(Location.id == current_loc_id).first()
            if loc:
                path.append(BreadcrumbItem(type="location", id=loc.id,
                                           name=getattr(loc, "name", str(loc.id))))
            break

        elif current_su_id:
            if current_su_id in visited:
                break
            visited.add(current_su_id)
            su = db.query(StorageUnit).filter(StorageUnit.id == current_su_id).first()
            if not su:
                break
            path.append(BreadcrumbItem(type="storage_unit", id=su.id, name=su.name))
            current_su_id = su.parent_storage_unit_id
            current_loc_id = su.location_id if not current_su_id else None

        elif current_box_id:
            if current_box_id in visited:
                break
            visited.add(current_box_id)
            box = db.query(Box).filter(Box.id == current_box_id).first()
            if not box:
                break
            path.append(BreadcrumbItem(type="box", id=box.id, name=box.inventory_number))
            current_box_id = box.parent_box_id
            current_su_id = box.storage_unit_id if not current_box_id else None
            current_loc_id = box.location_id if not current_box_id and not current_su_id else None

        else:
            break

    # Reverse: path was collected bottom-up, we want top-down
    path.reverse()
    return path
