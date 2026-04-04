import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AlertEvent(Base):
    """
    System-generated alerts: stock below minimum, warranty expiry, EOL approaching, etc.
    Separate from Event Bus (which is internal) — these are user-visible notifications.
    acknowledged_at: set when user dismisses/handles the alert.
    """
    __tablename__ = "alert_events"
    __table_args__ = (
        Index("idx_alert_events_tenant", "tenant_id"),
        Index("idx_alert_events_unack", "tenant_id", "acknowledged_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    alert_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # "stock_below_minimum" | "consumable_below_minimum" | "warranty_expiry_30d" |
    # "warranty_expiry_90d" | "eos_approaching_180d" | "eos_approaching_30d" |
    # "eos_reached" | "zabbix_alert" | "ilo_alert"

    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    # "info" | "warning" | "critical"

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "asset" | "consumable" | "stock_item" | "accessory"
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AlertEvent {self.alert_type} [{self.severity}]>"
