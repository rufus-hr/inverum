import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PlanMockWorkspace(Base):
    """
    Ephemeral mock workspaces within a Plan (planning phase).
    e.g. "12 hot-desk mjesta na novom katu" before physical setup.
    When plan approved → converted to real workspaces atomically.
    When plan cancelled → deleted with it.
    """
    __tablename__ = "plan_mock_workspaces"
    __table_args__ = (
        Index("idx_plan_mock_workspaces_plan", "plan_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    type: Mapped[str] = mapped_column(String(20), nullable=False, default="personal")
    # "personal" | "shared"

    mock_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plan_mock_locations.id"), nullable=True
    )
    # destination mock location (new location being planned)
    real_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id"), nullable=True
    )
    # or attach to existing location

    quantity: Mapped[int] = mapped_column(nullable=False, default=1)
    # how many workspaces of this type to create on approval

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
        return f"<PlanMockWorkspace {self.name} ({self.type}) x{self.quantity} plan:{self.plan_id}>"
