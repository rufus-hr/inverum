from datetime import datetime, timezone
from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.sql_revert_log import SqlRevertLog


@celery_app.task(name="app.tasks.cleanup.cleanup_revert_log")
def cleanup_revert_log():
    db = SessionLocal()
    try:
        db.query(SqlRevertLog).filter(
            SqlRevertLog.expires_at < datetime.now(timezone.utc)
        ).delete()
        db.commit()
    finally:
        db.close()
