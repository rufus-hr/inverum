import uuid
from datetime import datetime
from pydantic import BaseModel


# --- Upload ---

class SheetInfoResponse(BaseModel):
    name: str
    suggested_order: int
    likely_entity_type: str | None


class UploadResponse(BaseModel):
    job_id: uuid.UUID
    entity_type: str
    detected_headers: list[str]
    preview_rows: list[dict]
    total_rows: int | None
    sheets: list[SheetInfoResponse]  # empty for CSV


# --- Column mapping ---

class MappingRequest(BaseModel):
    mapping: dict[str, str]  # {csv_column: system_field | "metadata_field" | "asset_type_detector" | "auto_create_location"}


class MappingTemplateCreate(BaseModel):
    name: str
    entity_type: str
    mapping: dict[str, str]


class MappingTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    entity_type: str
    mapping: dict[str, str]
    created_at: datetime

    class Config:
        from_attributes = True


class MappingFromTemplateWarning(BaseModel):
    csv_column: str
    issue: str  # "missing_in_file" | "new_column_not_in_template"


class MappingFromTemplateResponse(BaseModel):
    mapping: dict[str, str]
    warnings: list[MappingFromTemplateWarning]


# --- Validation ---

class ValidateResponse(BaseModel):
    job_id: uuid.UUID
    status: str  # "validating"
    message: str


# --- Conflicts ---

class ConflictFieldDiff(BaseModel):
    field: str
    new_value: str | None
    existing_value: str | None
    is_conflict: bool


class ConflictResponse(BaseModel):
    id: uuid.UUID
    import_record_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    locked_by_job_id: uuid.UUID | None
    resolution: str | None
    field_diffs: list[ConflictFieldDiff]
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class ResolveRequest(BaseModel):
    resolution: str  # keep_existing | use_new | merge
    merge_decisions: dict[str, str] | None = None  # {field: "new"|"existing"} — only for merge


# --- Import job list ---

class ImportJobResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    status: str
    organization_id: uuid.UUID | None
    original_filename: str | None
    total_rows: int | None
    processed_rows: int
    error_count: int
    created_by: uuid.UUID
    expires_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


# --- API import ---

class ApiImportRequest(BaseModel):
    entity_type: str  # asset | location | employee | vendor
    records: list[dict]


# --- Confirm / Undo ---

class JobStatusResponse(BaseModel):
    job_id: uuid.UUID
    status: str
    message: str
