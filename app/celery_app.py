from celery import Celery
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
    },
)
