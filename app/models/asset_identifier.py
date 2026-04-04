import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AssetIdentifier(Base):
    """
    Multiple identifiers per asset: serial, MAC, IMEI, barcode, inventory_number, asset_tag.
    Enables barcode scanning, deduplication on import, multi-NIC MAC tracking.
    """
    __tablename__ = "asset_identifiers"
    __table_args__ = (
        Index("idx_asset_identifiers_asset", "asset_id"),
        Index("idx_asset_identifiers_value", "identifier_type", "value"),
        UniqueConstraint("tenant_id", "identifier_type", "value",
                         name="uq_asset_identifiers_tenant_type_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)

    identifier_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # "serial" | "mac" | "imei" | "barcode" | "inventory_number" | "asset_tag" | "custom"

    value: Mapped[str] = mapped_column(String(255), nullable=False)

    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # npr. "NIC 1 MAC", "IPMI MAC", "Original barcode"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AssetIdentifier {self.identifier_type}:{self.value} asset:{self.asset_id}>"
