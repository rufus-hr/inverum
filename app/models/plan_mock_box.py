import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanMockBox(Base):
    """
    Ephemeral mock boxes/pallets within a Plan (planning phase).
    When plan approved → converted to real boxes atomically.
    When plan cancelled → deleted with it.
    """
    __tablename__ = "plan_mock_boxes"
    __table_args__ = (
        Index("idx_plan_mock_boxes_plan", "plan_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"), nullable=False)

    inventory_number: Mapped[str] = mapped_column(String(50), nullable=False)
    # Box-001, Paleta-001

    parent_mock_box_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plan_mock_boxes.id"), nullable=True
    )
    # mock box-in-box

    type: Mapped[str] = mapped_column(String(20), nullable=False, default="box")
    # "box" | "pallet"

    mock_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plan_mock_locations.id"), nullable=True
    )
    # destination mock location (može biti i prava lokacija)
    real_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_asset_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

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
        return f"<PlanMockBox {self.inventory_number} plan:{self.plan_id}>"
