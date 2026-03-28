"""
Import validation Celery task.
Queue: inverum-worker-imports
Chunking: 1000 rows per subtask, parent tracks progress.
"""

import uuid
import logging
from app.celery_app import celery_app
from app.imports.storage import FileStorage, storage
from app.imports.normalizers import FieldNormalizer
from app.imports.conflicts import check_mandatory_fields, detect_conflict
from app.imports.parsers import ExcelParser, CsvParser
from app.core.database import SessionLocal
from app.models.import_job import ImportJob
from app.models.i18n import Language, Region
from app.models.import_job import ImportRecord, ImportConflict
from app.services.regional_settings import get_effective_regional_settings
from app.core.audit_listener import current_import_job_id, current_worker_task
from pathlib import Path
from celery import chord, group

logger = logging.getLogger(__name__)

@celery_app.task(
    bind=True,
    name="app.tasks.import_validation.validate_import",
    queue="inverum-worker-imports",
    max_retries=3,
    soft_time_limit=60 * 30,   # 30 min soft limit
    time_limit=60 * 35,        # 35 min hard limit
)
def validate_import(self, job_id: str) -> dict[str, int]:
    db = SessionLocal()
    try:
        job = _get_job(db, job_id)
        if job is None:
            logger.error("Validate_chunk: job not found: %s", job_id)
            return {"valid": 0, "conflict": 0, "error": 0}
        file = storage.read(storage.path_for_job(job.tenant_id, job.id, job.original_filename))

        ext = Path(job.original_filename).suffix.lower()
        if ext in (".xlsx", ".xls"):
            parser = ExcelParser()
        elif ext == ".csv":
            parser = CsvParser()
        else:
            logger.error("Unsupported file type: %s", ext)
            return {"valid": 0, "conflict": 0, "error": 0}
        result = parser.parse_all(file)
        mapped_rows = []
        for row in result.rows:
            mapped_row = {} 
            for csv_col, value in row.items():
                system_field = job.column_mapping.get(csv_col)
                if system_field:
                    mapped_row[system_field] = value
            mapped_rows.append(mapped_row)
        job.status = "validating"
        db.commit()
        tasks = []
        CHUNK_SIZE = 1000
        for i in range(0, len(mapped_rows), CHUNK_SIZE):
            chunk = mapped_rows[i:i + CHUNK_SIZE]
            tasks.append(validate_chunk.s(job_id, chunk, i))

        chord(group(tasks))(aggregate_validation_results.s(job_id))

    finally:
        db.close()

@celery_app.task(
    bind=True,
    name="app.tasks.import_validation.validate_chunk",
    queue="inverum-worker-imports",
)
def validate_chunk(self, job_id: str, rows: list[dict], row_offset: int) -> dict[str, int]:
    current_import_job_id.set(job_id)
    current_worker_task.set("validate_import")
    valid_count = 0
    conflict_count = 0
    error_count = 0
    db = SessionLocal()
    try:
        job = _get_job(db, job_id)
        if job is None:
            logger.error("validate_chunk: job not found: %s", job_id)
            return {"valid": 0, "conflict": 0, "error": 0}
        normalizer = _get_normalizer_for_job(job, db)
        for idx, row in enumerate(rows):
            error_message = None
            status = ""
            normalized = {}
            for field, value in row.items():
                output = normalizer.normalize(field, value)
                normalized[field] = output.value
            check_mandetory_field = check_mandatory_fields(job.entity_type, normalized)
            if check_mandetory_field:
                logger.error("validate_chunk: missing required field: %s", check_mandetory_field)
                status = "error"
                error_count += 1
            row_number = row_offset + idx
            conflict = None
            if status != "error":
                conflict = detect_conflict(db, job.entity_type, job.tenant_id, normalized, uuid.UUID(job_id))
                if conflict.has_conflict:
                    status = "conflict"
                    conflict_count += 1
                else:
                    valid_count += 1
                    status = "valid"
            error_message = ", ".join(check_mandetory_field) if check_mandetory_field else None

            record = ImportRecord(                                                                                                                                    
                import_job_id=job.id,                                                                                                                                 
                row_number=row_number,                                                                                                                                
                parsed_data=normalized,                               
                status=status,                                                                                                                                        
                error_message=error_message,
            )                                                                                                                                                         
            db.add(record)
            db.flush()
            if conflict and conflict.has_conflict:
                conflict_record = ImportConflict(                                                                                                                                           
                    import_job_id=job.id,                                                                                                                                 
                    import_record_id=record.id,                                                                                                                           
                    entity_type=job.entity_type,                                                                                                                          
                    entity_id=conflict.existing_entity_id,
                )
                db.add(conflict_record)
        db.commit()
        return {"valid": valid_count, "conflict": conflict_count, "error": error_count}

    finally:
        db.close()

@celery_app.task(
    name="app.tasks.import_validation.aggregate_validation_results",
    queue="inverum-worker-imports",
)
def aggregate_validation_results(chunk_results: list[dict], job_id: str) -> None:
    total_valid = 0
    total_conflict = 0
    total_error = 0
    for record in chunk_results:
        total_valid += record.get("valid")
        total_conflict += record.get("conflict")
        total_error += record.get("error")
    db = SessionLocal()
    try:
        job = _get_job(db, job_id)
        job.status = "pending_review"
        job.error_count = total_error
        db.commit()
    finally:
        db.close()

def _get_normalizer_for_job(job: ImportJob, db) -> FieldNormalizer:
    settings = get_effective_regional_settings(db, job.created_by, job.tenant_id)
    region_id = settings.get("region_id")
    region_code = "HR"  # default
    if region_id is not None:
        region = db.query(Region).filter(Region.id == region_id).first()
        if region:
            region_code = region.code
    language_id = settings.get("language_id")
    language_code = "HR"  # default
    if language_id is not None:
        language = db.query(Language).filter(Language.id == language_id).first()
        if language:
            language_code = language.code
    return FieldNormalizer(language_code=language_code, region_code=region_code, unit_display_settings=settings.get("unit_display_settings"))

def _get_job(db, job_id) -> ImportJob | None:
    return db.query(ImportJob).filter(
        ImportJob.id == uuid.UUID(job_id),
    ).first()
