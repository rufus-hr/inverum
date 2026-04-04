import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.auth import require_permission
from app.models.user import User
from app.models.asset import Asset
from app.models.asset_event import AssetEvent
from app.schemas.asset_event import AssetEventCreate, AssetEventResponse
from app.schemas.pagination import CursorPagedResponse
from app.dependencies.pagination import CursorPaginationParams, apply_cursor_pagination

router = APIRouter(prefix="/assets", tags=["asset-events"])


@router.get("/{asset_id}/events", response_model=CursorPagedResponse[AssetEventResponse])
def list_asset_events(
    asset_id: uuid.UUID,
    pagination: CursorPaginationParams = Depends(CursorPaginationParams),
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

    query = db.query(AssetEvent).filter(
        AssetEvent.asset_id == asset_id,
        AssetEvent.tenant_id == user.tenant_id,
    )
    items, next_cursor = apply_cursor_pagination(query, AssetEvent, pagination)
    return CursorPagedResponse(items=items, next_cursor=next_cursor, limit=pagination.limit)


@router.post("/{asset_id}/events", response_model=AssetEventResponse, status_code=201)
def create_asset_event(
    asset_id: uuid.UUID,
    data: AssetEventCreate,
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

    payload = data.model_dump()
    metadata = payload.pop("metadata", None)
    event = AssetEvent(
        tenant_id=user.tenant_id,
        asset_id=asset_id,
        metadata_=metadata,
        **payload,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/events/{event_id}", response_model=AssetEventResponse)
def get_asset_event(
    event_id: uuid.UUID,
    user: User = Depends(require_permission("asset:read")),
    db: Session = Depends(get_db),
):
    event = db.query(AssetEvent).filter(
        AssetEvent.id == event_id,
        AssetEvent.tenant_id == user.tenant_id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
