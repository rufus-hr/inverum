import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Integer, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class StockMovement(Base):
    """
    Immutable ledger — nema updated_at/deleted_at.
    Pozitivna quantity = dodavanje (reorder, primanje).
    Negativna quantity = uzimanje (upotreba, transfer, wasted).
    Točno jedan parent (location_id | storage_unit_id | box_id).
    """
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("idx_stock_movements_supply", "supply_id"),
        Index("idx_stock_movements_tenant_created", "tenant_id", "created_at"),
        CheckConstraint(
            "num_nonnulls(location_id, storage_unit_id, box_id) = 1",
            name="chk_stock_movement_single_parent",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    supply_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("supplies.id"), nullable=False)

    # Točno jedan od ova tri (gdje se movement dogodio):
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    storage_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_units.id"), nullable=True
    )
    box_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("boxes.id"), nullable=True)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Pozitivno = dodavanje, negativno = uzimanje

    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    # "purchase" | "usage" | "transfer" | "adjustment" | "wasted"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("work_orders.id"), nullable=True
    )

    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # "JRA-4012", "WO-2024-008" — slobodan string

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    # Nema updated_at i deleted_at — movement je immutable

    def __repr__(self) -> str:
        return f"<StockMovement supply:{self.supply_id} qty:{self.quantity} [{self.reason}]>"
