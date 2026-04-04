import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Component(Base):
    """
    Hardware komponente koje se instaliraju u assetove, stock ili druge komponente.
    RAM, CPU, GPU, NVMe, HDD, SSD, HBA, NIC...
    Polimorfan parent: installed_in_type + installed_in_id.
    """
    __tablename__ = "components"
    __table_args__ = (
        Index("idx_components_tenant", "tenant_id"),
        Index("idx_components_installed_in", "installed_in_type", "installed_in_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "RAM" | "CPU" | "GPU" | "NVMe" | "HDD" | "SSD" | "HBA" | "NIC" | "PSU" | "OTHER"

    manufacturer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("manufacturers.id"), nullable=True
    )
    part_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(255), nullable=True)

    specs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # RAM: {"form_factor": "SODIMM", "speed_mhz": 3200, "capacity_gb": 16, "ecc": false}
    # NVMe: {"form_factor": "M.2 2280", "capacity_gb": 512, "interface": "PCIe 4.0 x4"}
    # NIC: {"ports": 4, "speed": "10GbE", "connector": "SFP+"}

    installed_in_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "asset" | "stock" | "box" | "component"
    installed_in_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)

    parent_component_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("components.id"), nullable=True
    )
    # vizualni prikaz stabla samo (npr. RAID card → NVMe)

    installed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
        return f"<Component {self.type} {self.part_number}>"


class ComponentCompatibility(Base):
    """
    Compatibility rules između komponenti i asset konfiguracija.
    hard = fizički nemoguće (blokiraj).
    soft = moguće ali suboptimalno (upozori).
    """
    __tablename__ = "component_compatibility"
    __table_args__ = (
        Index("idx_component_compat_component", "component_id"),
        Index("idx_component_compat_config", "asset_configuration_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    component_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("components.id"), nullable=False
    )
    asset_configuration_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("asset_configurations.id"), nullable=False
    )

    compatibility_type: Mapped[str] = mapped_column(String(10), nullable=False)
    # "hard" | "soft"

    warning_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # "Existing 3200MHz + adding 2400MHz = downclock na 2400MHz"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<ComponentCompatibility {self.component_id} ↔ {self.asset_configuration_id} ({self.compatibility_type})>"
