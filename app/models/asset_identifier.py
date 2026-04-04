import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AssetIdentifier(Base):
    __tablename__ = "asset_identifiers"

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
    identifier_type: Mapped[str] = mapped_column(String(50), nullable=False)
    identifier_value: Mapped[str] = mapped_column(String(255), nullable=False)
    issued_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issued_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<AssetIdentifier {self.identifier_type}: {self.identifier_value}>"
