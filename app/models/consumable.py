import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Consumable(Base):
    """
    Consumables: toner, baterije, žarulje, filteri — troše se, ne vraćaju se.
    linked_asset_id: npr. toner → printer koji ga koristi.
    Kad current_quantity < minimum_quantity → Event Bus: consumable_below_minimum
    """
    __tablename__ = "consumables"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), nullable=False)
    manufacturer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("manufacturers.id"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    part_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="pcs")
    # "pcs" | "box" | "roll" | "liter"

    current_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minimum_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    box_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("boxes.id"), nullable=True)
    linked_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id"), nullable=True
    )
    # toner → printer, filter → UPS, etc.

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
        return f"<Consumable {self.name}: {self.current_quantity}{self.unit}>"
