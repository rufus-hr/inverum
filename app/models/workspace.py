import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        Index("idx_workspaces_tenant", "tenant_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_workspaces_location", "location_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_workspaces_user", "assigned_to_user_id", postgresql_where="deleted_at IS NULL"),
        Index("idx_workspaces_profile", "shared_desk_profile_id", postgresql_where="deleted_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "personal" | "shared"

    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    shared_desk_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("shared_desk_profiles.id"), nullable=True
    )

    # Faza 3 — Floor plan (columns exist, no logic yet)
    dxf_entity_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dxf_file_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    floor_plan_coordinates: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

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
        return f"<Workspace {self.name} ({self.type})>"
