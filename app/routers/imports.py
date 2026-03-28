import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.core.valkey import client as valkey

from app.dependencies.db import get_db
from app.dependencies.auth import get_current_user, require_permission, user_has_permission
from app.tasks.import_validation import validate_import
from app.imports.parsers import CsvParser, ExcelParser
from app.imports.storage import storage
from app.imports.field_aliases import suggest_mapping
from app.imports.conflicts import _MODEL_MAP
from app.models.import_job import ImportJob, ImportMappingTemplate
from app.models.user import User
from app.schemas.import_job import (
    ApiImportRequest,
    ImportJobResponse,
    JobStatusResponse,
    MappingFromTemplateResponse,
    MappingRequest,
    MappingTemplateCreate,
    MappingTemplateResponse,
    ResolveRequest,
    UploadResponse,
    ValidateResponse,
    ConflictResponse,
)
from app.schemas.pagination import PagedResponse

router = APIRouter(prefix="/imports", tags=["imports"])

_ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


# ---------------------------------------------------------------------------
# B4 — File upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_file(
    entity_type: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload CSV or Excel file. Creates ImportJob with status=draft.
    Returns detected headers, 10-row preview, and sheet list (Excel only).
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail=f"Unsupported file type '{ext}'. Allowed: .csv, .xlsx")

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="File exceeds 50MB limit")

    if ext == ".csv":
        result = CsvParser().parse(content)
    else:
        result = ExcelParser().parse(content)

    job = ImportJob(
        tenant_id=user.tenant_id,
        created_by=user.id,
        status="draft",
        entity_type=entity_type,
        original_filename=file.filename,
        total_rows=result.total_rows,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(job)
    db.flush()

    storage.save(user.tenant_id, job.id, file.filename or f"upload{ext}", content)
    job.detected_headers = result.headers
    db.commit()

    return UploadResponse(
        job_id=job.id,
        entity_type=entity_type,
        detected_headers=result.headers,
        preview_rows=result.preview_rows,
        total_rows=result.total_rows,
        sheets=result.sheets,
    )


# ---------------------------------------------------------------------------
# C2 — Column mapping
# ---------------------------------------------------------------------------

@router.post("/{job_id}/mapping", response_model=JobStatusResponse)
def set_column_mapping(
    job_id: uuid.UUID,
    data: MappingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()

    if job is None:
        raise HTTPException(status_code=404)   
    if job.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403)
    if job.created_by != user.id:
        if not user_has_permission(user, "import:edit", db):
            raise HTTPException(status_code=403)

    if job.status not in ("draft", "mapping"):
        raise HTTPException(status_code=409)

    job.column_mapping = data.model_dump()
    job.status = "mapping"
    db.commit()

    return job


# ---------------------------------------------------------------------------
# C3 — Mapping templates
# ---------------------------------------------------------------------------

@router.post("/templates", response_model=MappingTemplateResponse, status_code=201)
def create_mapping_template(
    data: MappingTemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ImportMappingTemplate).filter(
        ImportMappingTemplate.name == data.name, 
        ImportMappingTemplate.entity_type == data.entity_type,
        ImportMappingTemplate.tenant_id == user.tenant_id,).first()
    if query is not None:
         raise HTTPException(status_code=409)
    template = ImportMappingTemplate(**data.model_dump(), tenant_id=user.tenant_id, created_by=user.id)
    db.add(template)
    db.commit()

    return template

@router.get("/templates", response_model=list[MappingTemplateResponse])
def list_mapping_templates(
    entity_type: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    
    query = db.query(ImportMappingTemplate).filter(ImportMappingTemplate.tenant_id == user.tenant_id)
    if entity_type is not None:
        query = query.filter(ImportMappingTemplate.entity_type == entity_type)

    return query.all()


@router.post("/{job_id}/mapping/from-template/{template_id}", response_model=MappingFromTemplateResponse)
def apply_mapping_template(
    job_id: uuid.UUID,
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(ImportJob).filter(
        ImportJob.id == job_id,
    ).first()
    template = db.query(ImportMappingTemplate).filter(
        ImportMappingTemplate.id == template_id,
    ).first()
    if job is None:
        raise HTTPException(status_code=404)
    if job.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403)
    if template is None:
        raise HTTPException(status_code=404)
    if template.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403)


    result = suggest_mapping(job.detected_headers, job.entity_type, db)

    warnings = []                                                                                                                                             
    for header in template.mapping:                                                                                                                           
        if header not in result:                                                                                                                              
            warnings.append({"csv_column": header, "issue": "missing_in_file"})

    return MappingFromTemplateResponse(
        mapping = result,
        warnings = warnings,
    )
   



# ---------------------------------------------------------------------------
# D6 — Trigger validation
# ---------------------------------------------------------------------------

@router.post("/{job_id}/validate", response_model=ValidateResponse, status_code=202)
def trigger_validation(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job_details = db.query(ImportJob).filter(
        ImportJob.id == job_id,
        ImportJob.deleted_at.is_(None),
    ).first()
    if job_details is None:
        raise HTTPException(status_code=404)
    if job_details.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404)
    if job_details.created_by != user.id:
        if not user_has_permission(user, "import:edit", db):
            raise HTTPException(status_code=403)
    if job_details.status != "mapping":
        raise HTTPException(status_code=409, detail="Job must be in mapping status")

    validate_import.delay(str(job_id))
    job_details.status = "validating"
    db.commit()

    return ValidateResponse(job_id=job_id, status="validating")
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# E1 — List conflicts
# ---------------------------------------------------------------------------

@router.get("/{job_id}/conflicts", response_model=PagedResponse[ConflictResponse])
def list_conflicts(
    job_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conflicts_resposne = []
    job = db.query(ImportJob).filter(ImportJob.id == job_id, ImportJob.status == "pending_review").first()
    if job is None:
        raise HTTPException(status_code=404)
    for conflict in job.conflicts:
        model = _MODEL_MAP[conflict.entity_type]
        existing = db.query(model).filter(model.id == conflict.entity_id).first()
        record = conflict.record

        all_keys = {k for k in existing.__dict__ if not k.startswith("_")} | set(record.parsed_data.keys())
        diffs = [
            ConflictFieldDiff(
                field=field,
                existing_value=getattr(existing, field, None),
                new_value=record.parsed_data.get(field),
                is_conflict=getattr(existing, field, None) != record.parsed_data.get(field),
            )
            for field in all_keys
        ]
        key = f"import_lock:{conflict.entity_type}:{conflict.entity_id}"
        locked = valkey.get(key)
        locked_by_job_id = uuid.UUID(locked) if locked else None

        conflicts_resposne.append(ConflictResponse(
            id=conflict.id,
            import_record_id=conflict.import_record_id,
            entity_type=conflict.entity_type,
            entity_id=conflict.entity_id,
            locked_by_job_id=locked_by_job_id,  # fetch from Valkey
            resolution=conflict.resolution,
            field_diffs=diffs,
            resolved_at=conflict.resolved_at,
        ))
    total = len(conflicts_resposne)
    pages = (total + limit - 1) // limit
    return PagedResponse(items=conflicts_resposne, total=total, page=page, limit=limit, pages=pages)
        
# ---------------------------------------------------------------------------
# E2 — Resolve conflict
# ---------------------------------------------------------------------------

@router.post("/{job_id}/conflicts/{conflict_id}/resolve", response_model=JobStatusResponse)
def resolve_conflict(
    job_id: uuid.UUID,
    conflict_id: uuid.UUID,
    data: ResolveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(ImportJob).filter(ImportJob.id == job_id, ImportJob.status == "pending_review").first()
    if job is None:
        raise HTTPException(status_code=404)
    conflict = db.query(ImportConflict).filter(
        ImportConflict.id == conflict_id,
        ImportConflict.import_job_id == job_id,
    ).first()
    if conflict is None:
        raise HTTPException(status_code=404)
    conflict.resolution = data.resolution                                                                                                                     
    conflict.merge_decisions = data.merge_decisions                                                                                                           
    conflict.resolved_at = datetime.now(timezone.utc)                                                                                                         
    conflict.resolved_by = user.id                                                                                                                            
    db.commit()
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        message="Conflict resolved.",
    )


# ---------------------------------------------------------------------------
# G1 — API import (3rd party JSON)
# ---------------------------------------------------------------------------

@router.post("/api", response_model=ValidateResponse, status_code=202)
def api_import(
    data: ApiImportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import records from JSON (3rd party integration).
    Skips file upload and column mapping — goes straight to validation pipeline.
    """
    # TODO: implement
    # 1. Create ImportJob(status="validating", entity_type=data.entity_type)
    # 2. Store records directly as ImportRecords with parsed_data
    # 3. validate_import.delay(str(job_id))
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# H2 — Confirm
# ---------------------------------------------------------------------------

@router.post("/{job_id}/confirm", response_model=JobStatusResponse)
def confirm_import(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Materialize import: batch UPDATE import_pending → proper status.
    Requires all conflicts to be resolved.
    Writes audit log per record. Triggers NotificationService.
    """
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# H3 — Undo
# ---------------------------------------------------------------------------

@router.post("/{job_id}/undo", response_model=JobStatusResponse)
def undo_import(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Rollback: DELETE WHERE import_job_id = job_id.
    Only available within expires_at (24h window).
    Releases Valkey locks.
    """
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# I1 — List jobs
# ---------------------------------------------------------------------------

@router.get("/", response_model=PagedResponse[ImportJobResponse])
def list_jobs(
    status: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    created_by: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List import jobs. Without import:view permission: own jobs only.
    With import:view: all tenant jobs.
    """
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# I2 — Force close
# ---------------------------------------------------------------------------

@router.post("/{job_id}/force-close", response_model=JobStatusResponse)
def force_close(
    job_id: uuid.UUID,
    user: User = Depends(require_permission("import:edit")),
    db: Session = Depends(get_db),
):
    """
    Force job to failed status. Releases all Valkey locks.
    Requires import:edit permission.
    """
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")


# ---------------------------------------------------------------------------
# Job status (used for polling after validate)
# ---------------------------------------------------------------------------

@router.get("/{job_id}", response_model=ImportJobResponse)
def get_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current status and progress of an import job."""
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")
