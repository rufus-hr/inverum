import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, ForeignKey, Index, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (
        Index("idx_plans_tenant", "tenant_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_plans_status", "tenant_id", "status", postgresql_where="deleted_at IS NULL"),
        Index("idx_plans_location", "location_id", postgresql_where="deleted_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "new_location" | "dc_migration" | "network_reorg" | "custom"

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planning")
    # planning → approved → in_progress → completed | cancelled

    location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )
    canvas_session_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    # FK → user_settings canvas session (future)

    external_project_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Jira Epic ID, project key, itd.

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    planned_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    budget_planned: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    budget_actual: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    budget_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
        return f"<Plan {self.name} [{self.status}]>"
