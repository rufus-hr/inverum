import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=True
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id"),
        nullable=False
    )

    legal_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("legal_entities.id"),
        nullable=True
    )

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"),
        nullable=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    location_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reference_data.id"), nullable=False)
    address_street: Mapped[str] = mapped_column(String(255), nullable=True)
    address_city: Mapped[str] = mapped_column(String(100), nullable=True)
    address_zip: Mapped[str] = mapped_column(String(20), nullable=True)
    address_state: Mapped[str] = mapped_column(String(100), nullable=True)
    address_country: Mapped[str] = mapped_column(String(2), nullable=True)
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
        return f"<Location {self.name}>"



