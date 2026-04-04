import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ServiceRecord(Base):
    __tablename__ = "service_records"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid7
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id"),
        nullable=False
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id"),
        nullable=False
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.id"),
        nullable=True
    )
    warranty_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("warranties.id"),
        nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default='pending')
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    work_performed: Mapped[str | None] = mapped_column(Text, nullable=True)
    ticket_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_warranty_repair: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    tracking_number_out: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_return_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    tracking_number_in: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    def __repr__(self) -> str:
        return f"<ServiceRecord {self.asset_id}: {self.status}>"
