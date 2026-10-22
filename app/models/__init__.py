"""
Import all models so SQLAlchemy registers all tables and resolves all FKs.
Import this module before any DB operations to avoid NoReferencedTableError.
"""
from app.models.system_config import SystemConfig
from app.models.reference_data import ReferenceData
from app.models.tenant import Tenant
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.legal_entity import LegalEntity
from app.models.legal_entity_tax_id import LegalEntityTaxID
from app.models.organizations import Organization
from app.models.department import Department
from app.models.location import Location
from app.models.manufacturer import Manufacturer
from app.models.user import User, UserIdentity
from app.models.group import Group, UserGroup, GroupOrgScope, GroupLocationScope
from app.models.employee import Employee
from app.models.asset_category import AssetCategory
from app.models.asset_configuration import AssetConfiguration
from app.models.asset_product_line import AssetProductLine
from app.models.vendor import Vendor
from app.models.vendor_contact import VendorContact
from app.models.vendor_contract import VendorContract
from app.models.vendor_type import VendorType
from app.models.asset import Asset
from app.models.asset_assignment import AssetAssignment
from app.models.assignment_batch import AssignmentBatch
from app.models.asset_identifier import AssetIdentifier
from app.models.asset_event import AssetEvent
from app.models.asset_history import AssetHistory
from app.models.asset_document import AssetDocument
from app.models.asset_document_item import AssetDocumentItem
from app.models.storage_unit import StorageUnit
from app.models.box import Box
from app.models.supply import Supply
from app.models.stock_item import StockItem
from app.models.consumable import Consumable
from app.models.accessory import Accessory
from app.models.stock_movement import StockMovement
from app.models.stock_policy import StockPolicy
from app.models.asset_supply_requirement import AssetSupplyRequirement
from app.models.component import Component
from app.models.warranty import Warranty
from app.models.work_order import WorkOrder
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_record import ServiceRecord
from app.models.checklist_template import ChecklistTemplate
from app.models.checklist_item import ChecklistItem
from app.models.checklist_completion import ChecklistCompletion
from app.models.checklist_item_completion import ChecklistItemCompletion
from app.models.workspace import Workspace
from app.models.shared_desk_profile import SharedDeskProfile
from app.models.import_job import ImportJob
from app.models.event_bus import EventBus
from app.models.external_service import ExternalService
from app.models.plan import Plan
from app.models.plan_mock_asset import PlanMockAsset
from app.models.plan_mock_box import PlanMockBox
from app.models.plan_mock_location import PlanMockLocation
from app.models.plan_mock_workspace import PlanMockWorkspace
from app.models.comment import Comment
from app.models.document_template import DocumentTemplate
from app.models.alert_event import AlertEvent
from app.models.audit_log import AuditLog
from app.models.auth_audit_log import AuthAuditLog
from app.models.access_audit_log import AccessAuditLog
from app.models.data_audit_log import DataAuditLog
from app.models.worker_audit_log import WorkerAuditLog
from app.models.sql_revert_log import SqlRevertLog
from app.models.platform_user import PlatformUser
from app.models.country_tax_config import CountryTaxConfig
from app.models.i18n import Language, Region, RegionIdentifierType, TenantRegionalSettings, UserSettings

from sqlalchemy.orm import configure_mappers
configure_mappers()
