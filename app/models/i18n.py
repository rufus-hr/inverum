import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Language(Base):
    __tablename__ = "languages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)  # hr, en, de
    name: Mapped[str] = mapped_column(String(100), nullable=False)              # Hrvatski, English
    babel_code: Mapped[str] = mapped_column(String(20), nullable=False)         # hr_HR, de_DE
    text_direction: Mapped[str] = mapped_column(String(3), nullable=False, default="LTR")
    plural_rules: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    normalizations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)   # boolean terms, unit names per plural form
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Language {self.code} ({self.name})>"


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)  # HR, DE, US
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_language_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("languages.id"), nullable=False)
    decimal_separator: Mapped[str] = mapped_column(String(1), nullable=False)
    thousands_separator: Mapped[str] = mapped_column(String(1), nullable=False)
    date_format: Mapped[str] = mapped_column(String(20), nullable=False)        # DD.MM.YYYY | YYYY-MM-DD | MM/DD/YYYY
    csv_delimiter: Mapped[str] = mapped_column(String(1), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False)
    first_day_of_week: Mapped[str] = mapped_column(String(3), nullable=False, default="MON")
    timezone: Mapped[str] = mapped_column(String(50), nullable=False)
    measurement_system: Mapped[str] = mapped_column(String(10), nullable=False, default="metric")
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    default_language: Mapped["Language"] = relationship()
    identifier_types: Mapped[list["RegionIdentifierType"]] = relationship(back_populates="region", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Region {self.code} ({self.name})>"


class RegionIdentifierType(Base):
    __tablename__ = "region_identifier_types"
    __table_args__ = (
        UniqueConstraint("region_id", "code", name="uq_region_identifier_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    region_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regions.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)               # oib, vat_id, mbs, steuernummer
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    pattern: Mapped[str | None] = mapped_column(String(200), nullable=True)     # regex for format validation
    checksum_method: Mapped[str | None] = mapped_column(String(50), nullable=True)  # mod_11_10 | luhn | null
    prefix: Mapped[str | None] = mapped_column(String(5), nullable=True)        # HR for VAT ID, null for OIB
    applies_to: Mapped[str] = mapped_column(String(10), nullable=False)         # person | company | both
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    region: Mapped["Region"] = relationship(back_populates="identifier_types")

    def __repr__(self) -> str:
        return f"<RegionIdentifierType {self.region_id}:{self.code}>"


class TenantRegionalSettings(Base):
    __tablename__ = "tenant_regional_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), primary_key=True)
    language_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("languages.id"), nullable=False)
    region_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Nullable overrides — if set, take precedence over region defaults
    decimal_separator: Mapped[str | None] = mapped_column(String(1), nullable=True)
    thousands_separator: Mapped[str | None] = mapped_column(String(1), nullable=True)
    date_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    csv_delimiter: Mapped[str | None] = mapped_column(String(1), nullable=True)
    currency_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    first_day_of_week: Mapped[str | None] = mapped_column(String(3), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    measurement_system: Mapped[str | None] = mapped_column(String(10), nullable=True)
    unit_display_settings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    language: Mapped["Language"] = relationship()
    region: Mapped["Region"] = relationship()

    def __repr__(self) -> str:
        return f"<TenantRegionalSettings tenant={self.tenant_id}>"


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    language_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("languages.id"), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    language: Mapped["Language | None"] = relationship()

    def __repr__(self) -> str:
        return f"<UserSettings user={self.user_id}>"
