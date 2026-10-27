import logging
import bcrypt
from sqlalchemy.orm import Session

from app.core.config import settings
import app.models  # registers all models + configure_mappers()
from app.models.tenant import Tenant
from app.models.legal_entity import LegalEntity
from app.models.organizations import Organization
from app.models.location import Location
from app.models.department import Department
from app.models.user import User, UserIdentity
from app.models.system_config import SystemConfig
from app.models.reference_data import ReferenceData
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.group import Group, UserGroup
from app.seeds.config import ALL_SYSTEM_SEEDS

SYSTEM_PERMISSIONS = [
    {"code": "import:view", "name": "View Imports", "resource": "import", "action": "view", "description": "View all import jobs for the tenant"},
    {"code": "import:edit", "name": "Edit Imports", "resource": "import", "action": "edit", "description": "Resolve other users' conflicts and force-close import jobs"},
    {"code": "department:read", "name": "Read Departments", "resource": "department", "action": "read", "description": "View departments"},
    {"code": "department:create", "name": "Create Departments", "resource": "department", "action": "create", "description": "Create new departments"},
    {"code": "department:modify", "name": "Modify Departments", "resource": "department", "action": "modify", "description": "Update existing departments"},
    {"code": "department:delete", "name": "Delete Departments", "resource": "department", "action": "delete", "description": "Soft-delete departments"},
    # All router-required permissions
    {"code": "asset:create", "name": "Create Assets", "resource": "asset", "action": "create", "description": "Create assets"},
    {"code": "asset:read", "name": "Read Assets", "resource": "asset", "action": "read", "description": "View assets"},
    {"code": "asset:write", "name": "Write Assets", "resource": "asset", "action": "write", "description": "Create/update assets"},
    {"code": "asset:modify", "name": "Modify Assets", "resource": "asset", "action": "modify", "description": "Update assets"},
    {"code": "asset:delete", "name": "Delete Assets", "resource": "asset", "action": "delete", "description": "Delete assets"},
    {"code": "assets:read", "name": "Read Assets (plural)", "resource": "assets", "action": "read", "description": "View assets"},
    {"code": "assets:write", "name": "Write Assets (plural)", "resource": "assets", "action": "write", "description": "Write assets"},
    {"code": "assets:delete", "name": "Delete Assets (plural)", "resource": "assets", "action": "delete", "description": "Delete assets"},
    {"code": "asset_assignment:create", "name": "Create Assignments", "resource": "asset_assignment", "action": "create", "description": "Assign assets"},
    {"code": "asset_assignment:read", "name": "Read Assignments", "resource": "asset_assignment", "action": "read", "description": "View assignments"},
    {"code": "asset_assignment:modify", "name": "Modify Assignments", "resource": "asset_assignment", "action": "modify", "description": "Return assets"},
    {"code": "audit_log:read", "name": "Read Audit Log", "resource": "audit_log", "action": "read", "description": "View audit log"},
    {"code": "box:read", "name": "Read Boxes", "resource": "box", "action": "read", "description": "View boxes"},
    {"code": "box:write", "name": "Write Boxes", "resource": "box", "action": "write", "description": "Create/update boxes"},
    {"code": "component:read", "name": "Read Components", "resource": "component", "action": "read", "description": "View components"},
    {"code": "component:write", "name": "Write Components", "resource": "component", "action": "write", "description": "Create/update components"},
    {"code": "employee:create", "name": "Create Employees", "resource": "employee", "action": "create", "description": "Create employees"},
    {"code": "employee:read", "name": "Read Employees", "resource": "employee", "action": "read", "description": "View employees"},
    {"code": "employee:modify", "name": "Modify Employees", "resource": "employee", "action": "modify", "description": "Update employees"},
    {"code": "employee:delete", "name": "Delete Employees", "resource": "employee", "action": "delete", "description": "Delete employees"},
    {"code": "group:create", "name": "Create Groups", "resource": "group", "action": "create", "description": "Create groups"},
    {"code": "group:read", "name": "Read Groups", "resource": "group", "action": "read", "description": "View groups"},
    {"code": "group:modify", "name": "Modify Groups", "resource": "group", "action": "modify", "description": "Update groups"},
    {"code": "group:delete", "name": "Delete Groups", "resource": "group", "action": "delete", "description": "Delete groups"},
    {"code": "integration:manage", "name": "Manage Integrations", "resource": "integration", "action": "manage", "description": "Manage integrations"},
    {"code": "legal_entity:create", "name": "Create Legal Entities", "resource": "legal_entity", "action": "create", "description": "Create legal entities"},
    {"code": "legal_entity:read", "name": "Read Legal Entities", "resource": "legal_entity", "action": "read", "description": "View legal entities"},
    {"code": "legal_entity:modify", "name": "Modify Legal Entities", "resource": "legal_entity", "action": "modify", "description": "Update legal entities"},
    {"code": "legal_entity:delete", "name": "Delete Legal Entities", "resource": "legal_entity", "action": "delete", "description": "Delete legal entities"},
    {"code": "location:create", "name": "Create Locations", "resource": "location", "action": "create", "description": "Create locations"},
    {"code": "location:read", "name": "Read Locations", "resource": "location", "action": "read", "description": "View locations"},
    {"code": "location:modify", "name": "Modify Locations", "resource": "location", "action": "modify", "description": "Update locations"},
    {"code": "location:delete", "name": "Delete Locations", "resource": "location", "action": "delete", "description": "Delete locations"},
    {"code": "manufacturer:create", "name": "Create Manufacturers", "resource": "manufacturer", "action": "create", "description": "Create manufacturers"},
    {"code": "manufacturer:read", "name": "Read Manufacturers", "resource": "manufacturer", "action": "read", "description": "View manufacturers"},
    {"code": "manufacturer:modify", "name": "Modify Manufacturers", "resource": "manufacturer", "action": "modify", "description": "Update manufacturers"},
    {"code": "manufacturer:delete", "name": "Delete Manufacturers", "resource": "manufacturer", "action": "delete", "description": "Delete manufacturers"},
    {"code": "organization:create", "name": "Create Organizations", "resource": "organization", "action": "create", "description": "Create organizations"},
    {"code": "organization:read", "name": "Read Organizations", "resource": "organization", "action": "read", "description": "View organizations"},
    {"code": "organization:modify", "name": "Modify Organizations", "resource": "organization", "action": "modify", "description": "Update organizations"},
    {"code": "organization:delete", "name": "Delete Organizations", "resource": "organization", "action": "delete", "description": "Delete organizations"},
    {"code": "permission:create", "name": "Create Permissions", "resource": "permission", "action": "create", "description": "Create permissions"},
    {"code": "permission:read", "name": "Read Permissions", "resource": "permission", "action": "read", "description": "View permissions"},
    {"code": "reference_data:create", "name": "Create Reference Data", "resource": "reference_data", "action": "create", "description": "Create reference data"},
    {"code": "reference_data:read", "name": "Read Reference Data", "resource": "reference_data", "action": "read", "description": "View reference data"},
    {"code": "reference_data:modify", "name": "Modify Reference Data", "resource": "reference_data", "action": "modify", "description": "Update reference data"},
    {"code": "reference_data:delete", "name": "Delete Reference Data", "resource": "reference_data", "action": "delete", "description": "Delete reference data"},
    {"code": "role:create", "name": "Create Roles", "resource": "role", "action": "create", "description": "Create roles"},
    {"code": "role:read", "name": "Read Roles", "resource": "role", "action": "read", "description": "View roles"},
    {"code": "role:modify", "name": "Modify Roles", "resource": "role", "action": "modify", "description": "Update roles"},
    {"code": "stock:read", "name": "Read Stock", "resource": "stock", "action": "read", "description": "View stock"},
    {"code": "stock:write", "name": "Write Stock", "resource": "stock", "action": "write", "description": "Create/update stock"},
    {"code": "stock_item:create", "name": "Create Stock Items", "resource": "stock_item", "action": "create", "description": "Create stock items"},
    {"code": "stock_item:read", "name": "Read Stock Items", "resource": "stock_item", "action": "read", "description": "View stock items"},
    {"code": "stock_item:modify", "name": "Modify Stock Items", "resource": "stock_item", "action": "modify", "description": "Update stock items"},
    {"code": "stock_item:delete", "name": "Delete Stock Items", "resource": "stock_item", "action": "delete", "description": "Delete stock items"},
    {"code": "storage_unit:read", "name": "Read Storage Units", "resource": "storage_unit", "action": "read", "description": "View storage units"},
    {"code": "storage_unit:write", "name": "Write Storage Units", "resource": "storage_unit", "action": "write", "description": "Create/update storage units"},
    {"code": "storage_unit:delete", "name": "Delete Storage Units", "resource": "storage_unit", "action": "delete", "description": "Delete storage units"},
    {"code": "supply:read", "name": "Read Supplies", "resource": "supply", "action": "read", "description": "View supplies"},
    {"code": "supply:write", "name": "Write Supplies", "resource": "supply", "action": "write", "description": "Create/update supplies"},
    {"code": "supply:delete", "name": "Delete Supplies", "resource": "supply", "action": "delete", "description": "Delete supplies"},
    {"code": "tenant:create", "name": "Create Tenants", "resource": "tenant", "action": "create", "description": "Create tenants"},
    {"code": "tenant:read", "name": "Read Tenants", "resource": "tenant", "action": "read", "description": "View tenants"},
    {"code": "tenant:settings", "name": "Manage Tenant Settings", "resource": "tenant", "action": "settings", "description": "Manage tenant settings"},
    {"code": "user:read", "name": "Read Users", "resource": "user", "action": "read", "description": "View users"},
    {"code": "user:modify", "name": "Modify Users", "resource": "user", "action": "modify", "description": "Update users"},
    {"code": "user:delete", "name": "Delete Users", "resource": "user", "action": "delete", "description": "Delete users"},
    {"code": "vendor:read", "name": "Read Vendors", "resource": "vendor", "action": "read", "description": "View vendors"},
    {"code": "vendor:write", "name": "Write Vendors", "resource": "vendor", "action": "write", "description": "Create/update vendors"},
    {"code": "vendor:delete", "name": "Delete Vendors", "resource": "vendor", "action": "delete", "description": "Delete vendors"},
    {"code": "vendor_contract:create", "name": "Create Vendor Contracts", "resource": "vendor_contract", "action": "create", "description": "Create vendor contracts"},
    {"code": "vendor_contract:read", "name": "Read Vendor Contracts", "resource": "vendor_contract", "action": "read", "description": "View vendor contracts"},
    {"code": "vendor_contract:modify", "name": "Modify Vendor Contracts", "resource": "vendor_contract", "action": "modify", "description": "Update vendor contracts"},
    {"code": "vendor_contract:delete", "name": "Delete Vendor Contracts", "resource": "vendor_contract", "action": "delete", "description": "Delete vendor contracts"},
    {"code": "warranty:create", "name": "Create Warranties", "resource": "warranty", "action": "create", "description": "Create warranties"},
    {"code": "warranty:read", "name": "Read Warranties", "resource": "warranty", "action": "read", "description": "View warranties"},
    {"code": "warranty:modify", "name": "Modify Warranties", "resource": "warranty", "action": "modify", "description": "Update warranties"},
    {"code": "warranty:delete", "name": "Delete Warranties", "resource": "warranty", "action": "delete", "description": "Delete warranties"},
    {"code": "work_order:read", "name": "Read Work Orders", "resource": "work_order", "action": "read", "description": "View work orders"},
    {"code": "work_order:write", "name": "Write Work Orders", "resource": "work_order", "action": "write", "description": "Create/update work orders"},
    {"code": "workspace:read", "name": "Read Workspaces", "resource": "workspace", "action": "read", "description": "View workspaces"},
    {"code": "workspace:manage", "name": "Manage Workspaces", "resource": "workspace", "action": "manage", "description": "Create/update/delete workspaces"},
    {"code": "checklist:view", "name": "View Checklists", "resource": "checklist", "action": "view", "description": "View checklist templates and completions"},
    {"code": "checklist:manage", "name": "Manage Checklists", "resource": "checklist", "action": "manage", "description": "Create/edit checklist templates and cancel completions"},
    {"code": "checklist:fill", "name": "Fill Checklists", "resource": "checklist", "action": "fill", "description": "Check/uncheck checklist items"},
    {"code": "checklist:submit", "name": "Submit Checklists", "resource": "checklist", "action": "submit", "description": "Submit completed checklists"},
    {"code": "checklist:confirm", "name": "Confirm Checklists", "resource": "checklist", "action": "confirm", "description": "Confirm 4-eyes checklists"},
    {"code": "tenant:admin", "name": "Tenant Administrator", "resource": "tenant", "action": "admin", "description": "Full tenant and licensing administration"},
    {"code": "platform:procurement", "name": "MSP Cross-Tenant Procurement", "resource": "platform", "action": "procurement", "description": "View and export cross-tenant procurement shortages and renewals"},
]

logger = logging.getLogger(__name__)

SEED_KEY = "seed_v2"


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _seed_permissions(db: Session) -> None:
    for p in SYSTEM_PERMISSIONS:
        existing = db.query(Permission).filter_by(code=p["code"]).first()
        if existing:
            continue
        db.add(Permission(
            code=p["code"],
            name=p["name"],
            resource=p["resource"],
            action=p["action"],
            description=p.get("description"),
            is_active=True,
        ))
    db.flush()


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
    password_hash = _hash_password("admin")

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
        metadata_={"password_hash": _hash_password("admin")},
    ))

    # Create Super Admin role with ALL permissions
    role = Role(
        tenant_id=tenant.id,
        name="Super Admin",
        description="Full access to all resources",
        is_system=True,
    )
    db.add(role)
    db.flush()

    # Assign all permissions to role
    all_perms = db.query(Permission).filter(Permission.is_active == True).all()
    for perm in all_perms:
        db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    # Create admin group with role
    group = Group(
        tenant_id=tenant.id,
        role_id=role.id,
        name="Admins",
        description="Full access admin group",
    )
    db.add(group)
    db.flush()

    # Add user to group
    db.add(UserGroup(user_id=user.id, group_id=group.id))

    # Enable all modules for dev
    tenant.modules_enabled = {
        "vendors": True, "supplies": True, "storage": True,
        "maintenance": True, "checklists": True, "advanced_permissions": True,
        "integrations": True,
    }

    db.flush()

    # Seed comprehensive business data
    from app.seeds.dev_data import seed_dev_data
    seed_dev_data(db, tenant.id, user.id)

    logger.info("Dev seed complete: tenant=dev, admin user with Super Admin role + business data.")


def _sync_super_admin_permissions(db: Session) -> None:
    super_roles = db.query(Role).filter(Role.name == "Super Admin").all()
    if not super_roles:
        return
    all_perms = db.query(Permission).filter(Permission.is_active == True).all()
    for role in super_roles:
        existing_perm_ids = {
            rp.permission_id
            for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
        }
        for perm in all_perms:
            if perm.id not in existing_perm_ids:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))


def _ensure_platform_user(db: Session) -> None:
    from app.models.platform_user import PlatformUser, PlatformIdentity
    existing = db.query(PlatformIdentity).filter_by(provider="local", provider_id="msp_admin").first()
    if existing:
        return
    pu = PlatformUser(
        email="msp@inverum.eu",
        display_name="MSP Platform Owner",
        is_active=True,
    )
    db.add(pu)
    db.flush()
    db.add(PlatformIdentity(
        platform_user_id=pu.id,
        provider="local",
        provider_id="msp_admin",
        metadata_={"password_hash": _hash_password("admin")},
    ))
    db.flush()


def run_seeds(db: Session) -> None:
    try:
        already_seeded = db.query(SystemConfig).filter_by(key=SEED_KEY).first()
        if already_seeded:
            _seed_permissions(db)
            _sync_super_admin_permissions(db)
            _ensure_platform_user(db)
            db.commit()
            return

        _seed_reference_data(db, ALL_SYSTEM_SEEDS)
        _seed_permissions(db)
        _ensure_platform_user(db)

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
