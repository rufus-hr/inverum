import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class StockPolicy(Base):
    """
    Reorder policy za supply na određenoj lokaciji/storage unitu/boxu.
    Točno jedan parent (location_id | storage_unit_id | box_id).
    Parent mora biti is_stock_location=True (enforcirano u aplikaciji).
    """
    __tablename__ = "stock_policies"
    __table_args__ = (
        Index("idx_stock_policies_tenant", "tenant_id"),
        Index("idx_stock_policies_supply", "supply_id"),
        CheckConstraint(
            "num_nonnulls(location_id, storage_unit_id, box_id) = 1",
            name="chk_stock_policy_single_parent",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    supply_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("supplies.id"), nullable=False)

    # Točno jedan od ova tri:
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    storage_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_units.id"), nullable=True
    )
    box_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("boxes.id"), nullable=True)

    minimum_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # NULL = nema thresholda, nema alerta

    reorder_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    reorder_period_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # CAPEX forecast: reorder_quantity × unit_price × (12/reorder_period_months)

    responsible_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

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
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<StockPolicy supply:{self.supply_id}>"
