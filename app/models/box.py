import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Box(Base):
    __tablename__ = "boxes"
    __table_args__ = (
        Index("idx_boxes_tenant", "tenant_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_boxes_location", "location_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_boxes_parent", "parent_box_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_boxes_status", "tenant_id", "status", postgresql_where="deleted_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    inventory_number: Mapped[str] = mapped_column(String(50), nullable=False)
    # Box-001, Paleta-001

    parent_box_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("boxes.id"), nullable=True
    )
    # box-in-box (paleta → kutija → item)

    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    # open | sealed | in_transit | delivered | retired

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    # FK → plans.id (added after plans table exists)

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
        return f"<Box {self.inventory_number} [{self.status}]>"
