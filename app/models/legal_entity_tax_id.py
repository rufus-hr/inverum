import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class LegalEntityTaxID(Base):
    __tablename__ = "legal_entity_tax_ids"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    legal_entity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("legal_entities.id"),
        nullable=False
    )
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    type_code: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[str] = mapped_column(String(100), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<LegalEntityTaxID {self.type_code}: {self.value}>"