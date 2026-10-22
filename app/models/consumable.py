import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Consumable(Base):
    """
    Fizička instanca supply-ja koji se troši i ne vraća (toner, baterije, žarulje, filteri).
    Catalog metadata (name, part_number, unit, price) živi u Supply.
    supply_type mora biti "consumable".
    linked_asset_id: npr. toner → printer koji ga koristi.
    Kad current_quantity < minimum_quantity → Event Bus: consumable_below_minimum
    """
    __tablename__ = "consumables"
    __table_args__ = (
        Index("idx_consumables_tenant", "tenant_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_consumables_supply", "supply_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_consumables_location", "location_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_consumables_box", "box_id", postgresql_where="deleted_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    supply_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("supplies.id"), nullable=False)

    # Točno jedan od ova tri (gdje se item fizički nalazi):
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    storage_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_units.id"), nullable=True
    )
    box_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("boxes.id"), nullable=True)

    current_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minimum_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

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
        return f"<Consumable supply:{self.supply_id} qty:{self.current_quantity}>"
