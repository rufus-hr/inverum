"""
Vendor enrichment Celery task.
Runs after validation for matching assets/vendors.
Results stored as ImportRecord.suggested_data — never overwrites user data.
"""

import logging

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.valkey import get_valkey
from app.imports.enrichers import get_enricher
from app.models.import_job import ImportRecord

logger = logging.getLogger(__name__)

_ENRICH_TASKS_KEY = "import_enrich_tasks:{job_id}"


@celery_app.task(
    bind=True,
    name="app.tasks.import_enrich.enrich_record",
    queue="inverum-worker-default",
    acks_late=True,
    max_retries=2,
    soft_time_limit=30,
    time_limit=60,
)
def enrich_record(self, job_id: str, record_id: str) -> dict | None:
    """
    Enrich a single ImportRecord with data from external vendor API.
    Returns suggested_data dict or None if no enricher matched / API failed.
    """
    with SessionLocal() as db:
        record = db.get(ImportRecord, record_id)
        if not record or record.import_job_id != job_id:
            logger.warning("enrich_record: record %s not found or job mismatch", record_id)
            return None

        enricher = get_enricher(record.parsed_data or {})
        if not enricher:
            return None

        result = enricher.enrich(record.parsed_data or {})

        if result.confidence > 0.0:
            record.suggested_data = {
                "source": result.source,
                "confidence": result.confidence,
                "suggestions": result.suggestions,
            }
            db.commit()
            logger.info("enrich_record: enriched %s from %s (confidence=%.2f)", record_id, result.source, result.confidence)

        # Remove task ID from Valkey tracking set
        v = get_valkey()
        v.srem(_ENRICH_TASKS_KEY.format(job_id=job_id), self.request.id)

        return record.suggested_data


@celery_app.task(
    name="app.tasks.import_enrich.cancel_job_enrichments",
    queue="inverum-worker-default",
)
def cancel_job_enrichments(job_id: str) -> None:
    """
    Cancel all pending enrich tasks for a job.
    Called when job is confirmed or rolled back.
    """
    v = get_valkey()
    key = _ENRICH_TASKS_KEY.format(job_id=job_id)
    task_ids = v.smembers(key)

    if not task_ids:
        return

    celery_app.control.revoke(list(task_ids), terminate=True)
    v.delete(key)
    logger.info("cancel_job_enrichments: revoked %d tasks for job %s", len(task_ids), job_id)
