import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Supply(Base):
    """
    Konsolidirani model za sve potrošne/zalihe stavke.
    supply_type="consumable" → toner, baterije, miševi, kablovi, punjači (troše se)
    supply_type="stock_item" → SFP moduli, rezervni dijelovi, HDD za zamjenu
    Accessories su uklonjeni kao zasebni koncept — sve je Asset ili Supply.
    """
    __tablename__ = "supplies"
    __table_args__ = (
        Index("idx_supplies_tenant", "tenant_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_supplies_type", "tenant_id", "supply_type",
              postgresql_where="deleted_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    supply_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "consumable" | "stock_item"

    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # toner | battery | cable | sfp | mouse | keyboard | charger | adapter | spare_part | other
    # Iz reference_data — tenant može dodati vlastite

    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="kom")
    # "kom" | "m" | "l" | "pak" | "kg"

    compatible_with: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Slobodan tekst — "Cisco Catalyst serija", "Dell PowerEdge R7xx"
    # Informativno, Inverum ne validira kompatibilnost

    unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # Za CAPEX Intelligence forecast: reorder_quantity × unit_price × (12/reorder_period_months)

    vendor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vendors.id"), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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
        return f"<Supply {self.name} [{self.supply_type}]>"
