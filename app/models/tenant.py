import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

# Defaultni moduli za novi tenant — svi off
DEFAULT_MODULES = {
    "vendors": False,
    "supplies": False,
    "storage": False,
    "maintenance": False,
    "checklists": False,
    "advanced_permissions": False,
    # Faza 2: "integrations": False,
    # Faza 3: "classification": False,
}

DEFAULT_SETTINGS = {
    "currency": "EUR",
    "timezone": "Europe/Zagreb",
    "date_format": "DD.MM.YYYY",
    "language": "hr",
}

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid7
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_users: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_assets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    isolation_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="row")
    db_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    db_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    db_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    db_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    db_secret: Mapped[str | None] = mapped_column(String(500), nullable=True)
    db_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    modules_enabled: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=lambda: dict(DEFAULT_MODULES)
    )
    settings: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=lambda: dict(DEFAULT_SETTINGS)
    )

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
        return f"<Tenant {self.name}>"
