import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ChecklistItemCompletion(Base):
    __tablename__ = "checklist_item_completions"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )
    completion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("checklist_completions.id"),
        nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("checklist_items.id"),
        nullable=False
    )
    checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    checked_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )

    def __repr__(self) -> str:
        return f"<ChecklistItemCompletion {self.item_id}: {self.checked}>"
