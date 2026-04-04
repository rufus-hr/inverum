import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, Index, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class WorkOrder(Base):
    """
    Work Orders: maintenance, replenishment, installation, repair.
    Nije ticketing sustav — Inverum kreira WO PDF, šalje u Jiru, prima "zatvoreno".
    Potpisani dokument (PDF) u MinIO, vezan na asset history.
    """
    __tablename__ = "work_orders"
    __table_args__ = (
        Index("idx_work_orders_tenant", "tenant_id"),
        Index("idx_work_orders_asset", "asset_id"),
        Index("idx_work_orders_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    # "WO-2024-001" — generated, unique per tenant

    type: Mapped[str] = mapped_column(String(30), nullable=False)
    # "maintenance" | "replenishment" | "installation" | "repair"

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    # "open" | "in_progress" | "completed" | "cancelled"

    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id"), nullable=True
    )

    assignee_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # "internal" | "external_vendor"
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    # FK to users.id or vendors.id depending on assignee_type

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    cost_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    document_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    # FK to MinIO document ref (potpisani PDF)

    external_ticket_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Jira/ServiceNow issue ID

    created_by_event: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("event_bus.id"), nullable=True
    )
    # koji event_bus zapis kreirao ovaj WO — NULL = manualni

    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

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
        return f"<WorkOrder {self.number} [{self.status}]>"
