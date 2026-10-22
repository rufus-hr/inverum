import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AssetSupplyRequirement(Base):
    """
    Many-to-many: Asset/Accessory → Supply.
    Definira koji supply je potreban za određeni asset (ili accessory).
    Primjer: Kyocera ECOSYS M2040dn → Kyocera TK-1150 toner.

    entity_type: "asset" | "accessory"
    entity_id:   UUID aseta ili accessoryja koji zahtijeva ovaj supply
    supply_id:   Supply koji se troši / koristi za ovaj entitet
    quantity_per_cycle: koliko jedinica po ciklusu (npr. 1 toner po zamjeni)
    cycle_months: okvirno svakih N mjeseci (NULL = on-demand)
    """
    __tablename__ = "asset_supply_requirements"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "supply_id",
                         name="uq_asset_supply_requirement"),
        Index("idx_asr_entity", "entity_type", "entity_id"),
        Index("idx_asr_supply", "supply_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "asset" | "accessory"
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    supply_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("supplies.id"), nullable=False)

    quantity_per_cycle: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cycle_months: Mapped[int | None] = mapped_column(Integer, nullable=True)

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

    def __repr__(self) -> str:
        return f"<AssetSupplyRequirement {self.entity_type}:{self.entity_id} → supply:{self.supply_id}>"
