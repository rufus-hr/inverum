import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"
    __revertable__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id"),
        nullable=False
    )
    legal_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("legal_entities.id"),
        nullable=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"),
        nullable=True
    )
    configuration_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("asset_configurations.id"),
        nullable=True
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.id"),
        nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reference_data.id"),
        nullable=True
    )
    mobility_type: Mapped[str] = mapped_column(String(50), nullable=False, default='personal')
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    purchase_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    classification_level_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reference_data.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    asset_relations: Mapped[dict | None] = mapped_column(
        "asset_relations", JSONB, nullable=True
    )
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
        return f"<Asset {self.serial_number}: {self.name}>"