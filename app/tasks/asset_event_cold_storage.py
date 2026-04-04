from datetime import datetime, timezone, timedelta
from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.asset_event import AssetEvent
from app.models.asset import Asset


@celery_app.task(name="app.tasks.asset_event_cold_storage.archive_old_events")
def archive_old_events():
    """
    Archive asset events for retired/scrapped/disposed assets where
    the asset was last updated more than 90 days ago.
    Sets archived_at on events that are still NULL.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        retired_asset_ids = (
            db.query(Asset.id)
            .filter(
                Asset.status.in_(["retired", "scrapped", "disposed"]),
                Asset.updated_at < cutoff,
                Asset.deleted_at == None,
            )
            .subquery()
        )

        now = datetime.now(timezone.utc)
        db.query(AssetEvent).filter(
            AssetEvent.asset_id.in_(retired_asset_ids),
            AssetEvent.archived_at == None,
        ).update({"archived_at": now}, synchronize_session=False)

        db.commit()
    finally:
        db.close()
