import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanMockLocation(Base):
    """
    Ephemeral mock locations within a Plan (planning phase).
    e.g. "3 nova ureda na katu 2" before physical setup.
    When plan approved → converted to real locations atomically.
    When plan cancelled → deleted with it.
    """
    __tablename__ = "plan_mock_locations"
    __table_args__ = (
        Index("idx_plan_mock_locations_plan", "plan_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    parent_mock_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plan_mock_locations.id"), nullable=True
    )
    # mock location hijerarhija (zgrada → kat → soba)

    real_parent_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )
    # gdje u postojećoj hijerarhiji ovo ide (npr. kat 2 u HQ Zagreb)

    location_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "floor" | "room" | "rack" | "zone"

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

    def __repr__(self) -> str:
        return f"<PlanMockLocation {self.name} plan:{self.plan_id}>"
