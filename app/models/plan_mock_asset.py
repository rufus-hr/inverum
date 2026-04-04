import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanMockAsset(Base):
    """
    Ephemeral mock assets within a Plan (planning phase).
    No S/N, no vendor, no model — just type, quantity, estimated value.
    When plan is approved → converted to real `planned` assets atomically.
    When plan is cancelled/deleted → these are deleted with it.
    Never appears in main asset inventory.
    """
    __tablename__ = "plan_mock_assets"
    __table_args__ = (
        Index("idx_plan_mock_assets_plan", "plan_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"), nullable=False)

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("asset_categories.id"), nullable=True
    )
    type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # "Laptop", "Server", "Switch" — free text jer nema FK na pravi asset
    quantity: Mapped[int] = mapped_column(nullable=False, default=1)
    estimated_unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

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
        return f"<PlanMockAsset {self.type_name} x{self.quantity} plan:{self.plan_id}>"
