import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class StockPolicy(Base):
    """
    Reorder policies for stock_items, consumables, accessories.
    Defines alert thresholds, reorder quantities, and responsible person per item/location.
    """
    __tablename__ = "stock_policies"
    __table_args__ = (
        Index("idx_stock_policies_tenant", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "stock_item" | "consumable" | "accessory"
    item_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    # FK to stock_items.id / consumables.id / accessories.id depending on item_type

    alert_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # trigger alert when current_quantity <= alert_threshold
    reorder_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # suggested reorder quantity

    responsible_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # who gets notified

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    def __repr__(self) -> str:
        return f"<StockPolicy {self.name} ({self.item_type})>"
