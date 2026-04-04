import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class MaintenanceSchedule(Base):
    """
    Scheduled + ad-hoc maintenance rules.
    Scheduled: Celery Beat cron trigger → Event Bus → Work Order kreiran.
    Scope: po tipu asseta, modelu, lokaciji ili jednom assetu.
    """
    __tablename__ = "maintenance_schedules"
    __table_args__ = (
        Index("idx_maintenance_schedules_tenant", "tenant_id"),
        Index("idx_maintenance_schedules_next_run", "next_run_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    type: Mapped[str] = mapped_column(String(30), nullable=False)
    # "maintenance" | "inspection" | "firmware_update" | "cleaning" | "calibration"

    # Scope — jedan od ovih, ostali NULL
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id"), nullable=True
    )
    asset_configuration_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("asset_configurations.id"), nullable=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )
    asset_type_filter: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # free-text asset type filter kad nema asset_configuration_id

    recurrence: Mapped[str] = mapped_column(String(100), nullable=False)
    # "monthly" | "quarterly" | "annually" | cron expression "0 9 1 * *"

    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assignee_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # "internal" | "external_vendor"
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<MaintenanceSchedule {self.name} ({self.recurrence})>"
