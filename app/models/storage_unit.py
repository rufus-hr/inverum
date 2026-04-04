import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, Index, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class StorageUnit(Base):
    __tablename__ = "storage_units"
    __table_args__ = (
        Index("idx_storage_units_tenant", "tenant_id",
              postgresql_where="deleted_at IS NULL"),
        Index("idx_storage_units_location", "location_id",
              postgresql_where="deleted_at IS NULL"),
        Index("idx_storage_units_parent", "parent_storage_unit_id",
              postgresql_where="deleted_at IS NULL"),
        CheckConstraint("security_level BETWEEN 1 AND 5", name="chk_storage_unit_security_level"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # "Regal A1", "Ormar B", "Sef 1", "Polica 3C"

    type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "rack" | "cabinet" | "safe" | "cage" | "shelf" | "drawer"

    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), nullable=False)
    # Storage unit uvijek ima fiksnu lokaciju (sobu/skladište)

    parent_storage_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("storage_units.id"), nullable=True
    )
    # Polica je child od Regala, Ladica je child od Ormara

    is_lockable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    security_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # 1=otvoren regal, 2=zaključani ormar, 3=pojačani ormar, 4=sef, 5=trezor/kavez

    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Broj mjesta, nullable = neograničeno

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
        return f"<StorageUnit {self.name} [{self.type}] sec={self.security_level}>"
