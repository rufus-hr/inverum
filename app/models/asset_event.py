import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AssetEvent(Base):
    __tablename__ = "asset_events"
    __table_args__ = (
        Index("idx_asset_events_asset", "asset_id", "created_at"),
        Index("idx_asset_events_tenant", "tenant_id", "created_at"),
        Index("idx_asset_events_metadata_gin", "metadata",
              postgresql_using="gin",
              postgresql_ops={"metadata": "jsonb_path_ops"}),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # assigned | returned | status_changed | maintenance | checklist_completed
    # component_installed | component_removed | imported | retired | scrapped | ...

    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Human readable — "Dodijeljeno Ivanu Štimcu", "Vraćeno u stock"

    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "user" | "system" | "worker"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Denormalizirano — ostaje čak i ako user obriše račun

    diff_: Mapped[dict | None] = mapped_column("diff", JSONB, nullable=True)
    # Git-style diff: {"assigned_to": ["-Ana Kovač", "+Marko Horvat"], "status": ["-storage", "+assigned"]}

    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    # ticket_ref, work_order_id, assignment_id, checklist_completion_id...

    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # NULL = active, NOT NULL = cold storage (90 dana post-decommission)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AssetEvent {self.event_type} asset:{self.asset_id}>"
