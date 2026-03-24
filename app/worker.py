"""
Celery worker entry point.

Start with:
    celery -A app.worker worker --loglevel=info -Q inverum-worker-imports,inverum-worker-default

Or per-queue workers:
    celery -A app.worker worker --loglevel=info -Q inverum-worker-imports -c 2
    celery -A app.worker worker --loglevel=info -Q inverum-worker-default -c 4
    celery -A app.worker worker --loglevel=info -Q inverum-worker-critical -c 2
"""

from app.celery_app import celery_app  # noqa: F401 — re-export for celery -A app.worker
