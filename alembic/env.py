from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base
from app.models.tenant import Tenant
from app.models.legal_entity import LegalEntity
from app.models.country_tax_config import CountryTaxConfig
from app.models.legal_entity_tax_id import LegalEntityTaxID
from app.models.organizations import Organization
from app.models.reference_data import ReferenceData
from app.models.location import Location
from app.models.employee import Employee
from app.models.user import User, UserIdentity
from app.models.vendor import Vendor
from app.models.vendor_type import VendorType
from app.models.vendor_contract import VendorContract
from app.models.manufacturer import Manufacturer
from app.models.asset_product_line import AssetProductLine
from app.models.asset_configuration import AssetConfiguration
from app.models.asset import Asset
from app.models.asset_identifier import AssetIdentifier
from app.models.assignment_batch import AssignmentBatch
from app.models.asset_assignment import AssetAssignment
from app.models.warranty import Warranty
from app.models.service_record import ServiceRecord
from app.models.asset_history import AssetHistory
from app.models.comment import Comment
from app.models.document_template import DocumentTemplate
from app.models.asset_document import AssetDocument
from app.models.asset_document_item import AssetDocumentItem
from app.models.stock_item import StockItem
from app.models.stock_movement import StockMovement
from app.models.checklist_template import ChecklistTemplate
from app.models.checklist_item import ChecklistItem
from app.models.checklist_completion import ChecklistCompletion
from app.models.checklist_item_completion import ChecklistItemCompletion
from app.models.audit_log import AuditLog
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.group import Group, UserGroup, GroupOrgScope, GroupLocationScope
from app.models.platform_user import PlatformUser, PlatformIdentity, PlatformUserRole
from app.models.system_config import SystemConfig
from app.models.import_job import ImportJob, ImportRecord, ImportConflict, ImportMappingTemplate
from app.models.i18n import Language, Region, RegionIdentifierType, TenantRegionalSettings, UserSettings
from app.models.department import Department

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=settings.DATABASE_URL,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()