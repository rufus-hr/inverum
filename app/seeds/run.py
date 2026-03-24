import logging
import bcrypt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tenant import Tenant
from app.models.legal_entity import LegalEntity
from app.models.organizations import Organization
from app.models.location import Location
from app.models.user import User, UserIdentity
from app.models.system_config import SystemConfig
from app.models.reference_data import ReferenceData
from app.seeds.config import ALL_SYSTEM_SEEDS

logger = logging.getLogger(__name__)

SEED_KEY = "seed_v2"


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


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


def _seed_demo(db: Session) -> None:
    existing_tenant = db.query(Tenant).filter_by(slug="acme").first()
    if existing_tenant:
        logger.info("Demo tenant already exists, skipping demo seed.")
        return

    tenant = Tenant(
        name="Acme Corp d.o.o.",
        slug="acme",
        is_active=True,
    )
    db.add(tenant)
    db.flush()

    legal_entity = LegalEntity(
        tenant_id=tenant.id,
        name="Acme Corp",
        legal_name="Acme Corp d.o.o.",
        is_active=True,
    )
    db.add(legal_entity)
    db.flush()

    org = Organization(
        tenant_id=tenant.id,
        legal_entity_id=legal_entity.id,
        name="IT Department",
        is_active=True,
    )
    db.add(org)

    hq = Location(
        tenant_id=tenant.id,
        name="HQ Zagreb",
        location_type="building",
        address_city="Zagreb",
        address_country="HR",
        is_active=True,
    )
    db.add(hq)
    db.flush()

    server_room = Location(
        tenant_id=tenant.id,
        parent_id=hq.id,
        name="Server Room",
        location_type="room",
        is_active=True,
    )
    db.add(server_room)

    warehouse = Location(
        tenant_id=tenant.id,
        parent_id=hq.id,
        name="IT Warehouse",
        location_type="warehouse",
        is_active=True,
    )
    db.add(warehouse)

    demo_users = [
        ("admin", "Admin User", "admin"),
        ("tech", "Tech User", "tech"),
        ("manager", "Manager User", "manager"),
    ]
    password_hash = _hash_password("inverum2026")

    for username, display_name, _ in demo_users:
        user = User(
            tenant_id=tenant.id,
            display_name=display_name,
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(UserIdentity(
            user_id=user.id,
            tenant_id=tenant.id,
            provider="local",
            provider_id=username,
            metadata_={"password_hash": password_hash},
        ))

    logger.info("Demo seed complete: tenant=acme, 3 users, 1 org, 3 locations.")


def _seed_dev(db: Session) -> None:
    existing_tenant = db.query(Tenant).filter_by(slug="dev").first()
    if existing_tenant:
        logger.info("Dev tenant already exists, skipping dev seed.")
        return

    tenant = Tenant(
        name="Dev Tenant",
        slug="dev",
        is_active=True,
    )
    db.add(tenant)
    db.flush()

    user = User(
        tenant_id=tenant.id,
        display_name="Dev Admin",
        is_active=True,
    )
    db.add(user)
    db.flush()

    db.add(UserIdentity(
        user_id=user.id,
        tenant_id=tenant.id,
        provider="local",
        provider_id="admin",
        metadata_={"password_hash": _hash_password("devpassword")},
    ))

    logger.info("Dev seed complete: tenant=dev, admin user created.")


def run_seeds(db: Session) -> None:
    try:
        already_seeded = db.query(SystemConfig).filter_by(key=SEED_KEY).first()
        if already_seeded:
            return

        _seed_reference_data(db, ALL_SYSTEM_SEEDS)

        env = settings.ENVIRONMENT

        if env == "demo":
            _seed_demo(db)
        elif env == "dev":
            _seed_dev(db)
        elif env == "prod":
            # prod: system reference data only
            # tenant is created via onboarding flow, not seed
            # SEED_COMPLEXITY determines onboarding template offered (simple/msp/enterprise)
            # template selection logic goes here in future
            logger.info(
                "Prod seed: system reference data only. "
                "SEED_COMPLEXITY=%s (onboarding template selection — not yet implemented).",
                settings.SEED_COMPLEXITY,
            )
        else:
            logger.warning("Unknown ENVIRONMENT=%s, only system reference data seeded.", env)

        from datetime import datetime, timezone
        db.add(SystemConfig(
            key=SEED_KEY,
            value=datetime.now(timezone.utc).isoformat(),
        ))
        db.commit()
        logger.info("Seeds committed. ENVIRONMENT=%s SEED_KEY=%s", env, SEED_KEY)

    except Exception:
        logger.exception("Seed failed — rolling back.")
        db.rollback()
