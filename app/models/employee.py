import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Employee(Base):
    __tablename__ = "employees"
    __revertable__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid7
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

    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id"),
        nullable=True
    )

    default_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"),
        nullable=True
    )


    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    employee_number: Mapped[str] = mapped_column(String(50), nullable=True)
    job_title: Mapped[str] = mapped_column(String(100), nullable=True)
    job_level: Mapped[str] = mapped_column(String(50), nullable=True)
    employment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
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
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )


    def __repr__(self) -> str:
        return f"<Employee {self.first_name} : {self.last_name}>"



