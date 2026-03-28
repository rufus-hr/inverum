import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Status flow: draft → mapping → validating → pending_review → confirmed | rolled_back | failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # asset | location | employee | vendor

    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sheet_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    column_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    detected_headers: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    total_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    records: Mapped[list["ImportRecord"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    conflicts: Mapped[list["ImportConflict"]] = relationship(back_populates="job", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ImportJob {self.id} {self.entity_type} {self.status}>"


class ImportRecord(Base):
    __tablename__ = "import_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    import_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_jobs.id"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    parsed_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    suggested_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # vendor enrich suggestions
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # valid | conflict | error
    error_message: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    job: Mapped["ImportJob"] = relationship(back_populates="records")
    conflict: Mapped["ImportConflict | None"] = relationship(back_populates="record", uselist=False)

    def __repr__(self) -> str:
        return f"<ImportRecord job={self.import_job_id} row={self.row_number} {self.status}>"


class ImportConflict(Base):
    __tablename__ = "import_conflicts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    import_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_jobs.id"), nullable=False)
    import_record_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("import_records.id"), nullable=False, unique=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False)  # existing record that conflicts
    # Lock info lives in Valkey (key: import_lock:{entity_type}:{entity_id}), not in DB.
    # Read from Valkey when serving this conflict via API.

    resolution: Mapped[str | None] = mapped_column(String(50), nullable=True)  # keep_existing | use_new | merge
    merge_decisions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {field: "new"|"existing"}
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    job: Mapped["ImportJob"] = relationship(back_populates="conflicts", foreign_keys=[import_job_id])
    record: Mapped["ImportRecord"] = relationship(back_populates="conflict")

    def __repr__(self) -> str:
        return f"<ImportConflict job={self.import_job_id} entity={self.entity_type}:{self.entity_id}>"


class ImportMappingTemplate(Base):
    __tablename__ = "import_mapping_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "entity_type", name="uq_mapping_template"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    mapping: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {csv_column: system_field}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ImportMappingTemplate {self.name} {self.entity_type}>"
