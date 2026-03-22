from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.tenant import Tenant  # noqa: F401 - needed for FK resolution
from app.models.system_config import SystemConfig
from app.models.reference_data import ReferenceData
from app.seeds.asset_statuses import ASSET_STATUSES

SEED_KEY = "seed_imported"


def _seed_reference_data(db: Session, rows: list[dict]) -> None:
    for row in rows:
        existing = db.query(ReferenceData).filter_by(
            category=row["category"],
            code=row["code"],
            tenant_id=None,
        ).first()
        if existing:
            continue
        db.add(ReferenceData(
            category=row["category"],
            code=row["code"],
            label=row["label"],
            is_system=row.get("is_system", True),
            is_active=True,
            display_order=row.get("display_order", 0),
            metadata_=row.get("metadata_"),
            tenant_id=None,
        ))


def run_seeds(db: Session) -> None:
    already_seeded = db.query(SystemConfig).filter_by(key=SEED_KEY).first()
    if already_seeded:
        return

    _seed_reference_data(db, ASSET_STATUSES)

    db.add(SystemConfig(
        key=SEED_KEY,
        value=datetime.now(timezone.utc).isoformat(),
    ))
    db.commit()
