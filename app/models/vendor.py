import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Vendor(Base):
    __tablename__ = "vendors"
    __revertable__ = True
    __table_args__ = (
        Index("idx_vendors_tenant", "tenant_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_vendors_tenant_name", "tenant_id", "name",
              postgresql_where="deleted_at IS NULL"),
        Index("idx_vendors_types_gin", "vendor_types",
              postgresql_using="gin",
              postgresql_ops={"vendor_types": "jsonb_path_ops"}),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    oib: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vat_id: Mapped[str | None] = mapped_column(String(30), nullable=True)

    vendor_types: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # ["reseller", "service", "distributor", "manufacturer"] — not mutual exclusive

    manufacturer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("manufacturers.id"), nullable=True
    )
    # Lenovo HR d.o.o. je i vendor i manufacturer — OK, nisu iste tablice

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Legacy contact fields (kept for import compatibility)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_country: Mapped[str | None] = mapped_column(String(2), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    import_job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("import_jobs.id"),
        nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    def __repr__(self) -> str:
        return f"<Vendor {self.name}>"