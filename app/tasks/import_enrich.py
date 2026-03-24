"""
Vendor enrichment Celery task.
Runs after validation for matching assets/vendors.
Results stored as ImportRecord.suggested_data — never overwrites user data.
"""

from app.celery_app import celery_app


@celery_app.task(
    bind=True,
    name="app.tasks.import_enrich.enrich_record",
    queue="inverum-worker-default",
    max_retries=2,
    soft_time_limit=30,
    time_limit=60,
)
def enrich_record(self, job_id: str, record_id: str) -> dict | None:
    """
    Enrich a single ImportRecord with data from external vendor API.
    Returns suggested_data dict or None if no enricher matched / API failed.
    """
    # TODO: implement
    # 1. Load ImportRecord from DB
    # 2. get_enricher(record.parsed_data)
    # 3. enricher.enrich(record.parsed_data)
    # 4. UPDATE import_records SET suggested_data = ... WHERE id = record_id
    raise NotImplementedError


@celery_app.task(
    name="app.tasks.import_enrich.cancel_job_enrichments",
    queue="inverum-worker-default",
)
def cancel_job_enrichments(job_id: str) -> None:
    """
    Cancel all pending enrich tasks for a job.
    Called when job is confirmed or rolled back.
    """
    # TODO: implement
    # Use celery.control.revoke(task_id, terminate=True) for each pending task
    # Track task IDs in Valkey: import_enrich_tasks:{job_id} → set of task_ids
    raise NotImplementedError
