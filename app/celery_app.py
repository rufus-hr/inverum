from celery import Celery
from celery.schedules import crontab
from datetime import timedelta
from app.core.config import settings

# Valkey is Redis-compatible — Celery uses redis:// protocol
_broker_url = settings.VALKEY_URL.replace("valkey://", "redis://")

celery_app = Celery(
    "inverum",
    broker=_broker_url,
    backend=_broker_url,
    include=[
        "app.tasks.import_validation",
        "app.tasks.import_enrich",
        "app.tasks.process_event",
        "app.tasks.cleanup",
        "app.tasks.asset_event_cold_storage",
        "app.tasks.dashboard_stats",
        "app.tasks.tsa_renewal",
        "app.tasks.compliance_reports",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,         # re-queue on worker crash
    worker_prefetch_multiplier=1,  # fair dispatch for long-running tasks
    task_routes={
        "app.tasks.import_validation.*": {"queue": "inverum-worker-imports"},
        "app.tasks.import_enrich.*": {"queue": "inverum-worker-default"},
        "app.tasks.process_event.*": {"queue": "inverum-worker-default"},
        "app.tasks.cleanup.*": {"queue": "inverum-worker-default"},
        "app.tasks.asset_event_cold_storage.*": {"queue": "inverum-worker-default"},
        "app.tasks.tsa_renewal.*": {"queue": "inverum-worker-default"},
        "app.tasks.compliance_reports.*": {"queue": "inverum-worker-default"},
    },
    beat_schedule={
        "cleanup-revert-log-hourly": {
            "task": "app.tasks.cleanup.cleanup_revert_log",
            "schedule": crontab(minute=0),  # every hour
        },
        "archive-asset-events-daily": {
            "task": "app.tasks.asset_event_cold_storage.archive_old_events",
            "schedule": crontab(hour=3, minute=0),  # 03:00 UTC
        },
        "compute-dashboard-stats": {
            "task": "app.tasks.dashboard_stats.compute_dashboard_stats",
            "schedule": timedelta(seconds=120),  # every 2 minutes
        },
        "renew-pades-lta-timestamps-monthly": {
            "task": "app.tasks.tsa_renewal.renew_expiring_pades_timestamps",
            "schedule": crontab(day_of_month=1, hour=2, minute=30),  # 1st of month 02:30 UTC
        },
        "compliance-reports-daily": {
            "task": "app.tasks.compliance_reports.run_scheduled_compliance_reports",
            "schedule": crontab(hour=5, minute=30),  # daily at 05:30 UTC
            "args": ("daily",),
        },
        "compliance-reports-weekly": {
            "task": "app.tasks.compliance_reports.run_scheduled_compliance_reports",
            "schedule": crontab(day_of_week=1, hour=6, minute=0),  # Monday 06:00 UTC
            "args": ("weekly",),
        },
        "compliance-reports-monthly": {
            "task": "app.tasks.compliance_reports.run_scheduled_compliance_reports",
            "schedule": crontab(day_of_month=1, hour=3, minute=30),  # 1st of month 03:30 UTC
            "args": ("monthly",),
        },
    },
)
