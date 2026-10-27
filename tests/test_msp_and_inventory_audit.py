"""
Tests for Phase 5 (`T5.1`-`T5.3` MSP Cross-Tenant Procurement) and Phase 8 (`T8.2` Physical Inventory Audit & PAdES Report).
"""
from __future__ import annotations

import unittest
import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import jwt

from app.core.config import settings
from app.core.security import ALGORITHM
from app.models.asset import Asset
from app.models.asset_document import AssetDocument
from app.models.consumable import Consumable
from app.models.location import Location
from app.models.manufacturer import Manufacturer
from app.models.platform_user import PlatformIdentity, PlatformUser
from app.models.stock_policy import StockPolicy
from app.models.supply import Supply
from app.models.tenant import Tenant
from app.models.vendor import Vendor
from app.models.vendor_contract import VendorContract
from app.models.warranty import Warranty
from app.routers.documents import InventoryAuditItemPayload, InventoryAuditRequest, generate_signed_inventory_audit_pdf
from app.routers.platform_msp import (
    ExportOrderRequest,
    PlatformActor,
    PlatformLoginRequest,
    _collect_expiring_data,
    _collect_shortages_data,
    export_consolidated_order,
    platform_login,
)
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin, hash_password


class TestMspProcurementAndInventoryAudit(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant_a, self.user_a, _ = create_test_tenant_and_admin(self.db)
        self.tenant_b = Tenant(
            id=uuid.uuid4(),
            name="Drugi Klijent d.o.o.",
            slug="drugi-klijent",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.tenant_b)

        # PlatformUser setup
        self.platform_user = PlatformUser(
            id=uuid.uuid4(),
            email="msp@inverum.eu",
            display_name="MSP Owner",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.platform_user)
        self.platform_identity = PlatformIdentity(
            id=uuid.uuid4(),
            platform_user_id=self.platform_user.id,
            provider="local",
            provider_id="msp_admin",
            metadata_={"password_hash": hash_password("MspSecret123!")},
            deleted_at=None,
        )
        self.platform_identity.platform_user = self.platform_user
        self.db.add(self.platform_identity)

    @patch("app.routers.platform_msp.get_valkey", return_value=None)
    def test_t5_1_platform_user_login_issues_platform_scope_jwt(self, _mock_vk) -> None:
        res = platform_login(
            PlatformLoginRequest(
                provider="local",
                provider_id="msp_admin",
                password="MspSecret123!",
            ),
            self.db,
        )
        payload = jwt.decode(res.access_token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        self.assertEqual(payload["sub"], str(self.platform_user.id))
        self.assertEqual(payload["scope"], "platform")
        self.assertIsNone(payload["tenant_id"])

    def test_t5_2_cross_tenant_shortages_and_expiring_aggregation(self) -> None:
        vendor = Vendor(id=uuid.uuid4(), tenant_id=self.tenant_a.id, name="ALSO Croatia d.o.o.", deleted_at=None)
        mfg = Manufacturer(id=uuid.uuid4(), name="Cisco", slug="cisco", deleted_at=None)
        self.db.add(vendor)
        self.db.add(mfg)

        # Same SKU part number in Tenant A and Tenant B, both below minimum stock
        sup_a = Supply(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            name="Cisco 10G SFP+ Transceiver",
            part_number="SFP-10G-SR",
            supply_type="consumable",
            category="sfp",
            unit="kom",
            unit_price=Decimal("45.00"),
            currency="EUR",
            vendor_id=vendor.id,
            manufacturer_id=mfg.id,
            is_active=True,
            deleted_at=None,
        )
        sup_b = Supply(
            id=uuid.uuid4(),
            tenant_id=self.tenant_b.id,
            name="Cisco 10G SFP+ Transceiver",
            part_number="SFP-10G-SR",
            supply_type="consumable",
            category="sfp",
            unit="kom",
            unit_price=Decimal("45.00"),
            currency="EUR",
            vendor_id=vendor.id,
            manufacturer_id=mfg.id,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(sup_a)
        self.db.add(sup_b)

        self.db.add(Consumable(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            supply_id=sup_a.id,
            current_quantity=2,
            minimum_quantity=10,
            deleted_at=None,
        ))
        self.db.add(Consumable(
            id=uuid.uuid4(),
            tenant_id=self.tenant_b.id,
            supply_id=sup_b.id,
            current_quantity=1,
            minimum_quantity=6,
            deleted_at=None,
        ))

        shortages = _collect_shortages_data(self.db)
        self.assertEqual(shortages["summary"]["total_skus_short"], 1)
        # Deficit in Tenant A = 8, Deficit in Tenant B = 5 -> Total = 13 units consolidated under SFP-10G-SR
        self.assertEqual(shortages["summary"]["total_units_to_order"], 13)
        self.assertEqual(shortages["summary"]["tenants_affected_count"], 2)
        self.assertEqual(shortages["consolidated_shortages"][0]["part_number"], "SFP-10G-SR")
        self.assertAlmostEqual(shortages["consolidated_shortages"][0]["estimated_order_cost"], 13 * 45.0)

        # Expiring contract + warranty across tenants
        self.db.add(VendorContract(
            id=uuid.uuid4(),
            tenant_id=self.tenant_b.id,
            vendor_id=vendor.id,
            name="Godišnji SLA ugovor",
            contract_number="SLA-2026-99",
            contract_type="support",
            end_date=date.today() + timedelta(days=25),
            value=Decimal("2400.00"),
            currency="EUR",
            auto_renew=False,
            is_active=True,
            deleted_at=None,
        ))
        expiring = _collect_expiring_data(self.db, days=90)
        self.assertGreaterEqual(expiring["summary"]["contracts_count"], 1)
        self.assertGreaterEqual(expiring["summary"]["total_estimated_value"], 2400.0)

        # CSV export verification
        actor = PlatformActor(id=self.platform_user.id, display_name="MSP Owner")
        csv_resp = export_consolidated_order(
            ExportOrderRequest(format="csv", days=90),
            actor=actor,
            db=self.db,
        )
        self.assertIn(b"SFP-10G-SR", csv_resp.body)
        self.assertIn(b"SLA-2026-99", csv_resp.body)

    @patch("app.routers.documents.store_document_in_minio", return_value="documents/test-audit.pdf")
    def test_t8_2_inventory_audit_relocates_misplaced_and_signs_pdf(self, _mock_minio) -> None:
        loc_a = Location(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            name="Server Room A",
            is_active=True,
            deleted_at=None,
        )
        loc_b = Location(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            name="Room 204 (Audited)",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(loc_a)
        self.db.add(loc_b)

        misplaced_asset = Asset(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            organization_id=uuid.uuid4(),
            location_id=loc_a.id,
            name="ThinkPad X1 Carbon",
            serial_number="SN-MISPLACED-01",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(misplaced_asset)

        req = InventoryAuditRequest(
            location_id=str(loc_b.id),
            location_name=loc_b.name,
            relocate_misplaced=True,
            items=[
                InventoryAuditItemPayload(
                    asset_id=str(misplaced_asset.id),
                    inventory_number="SN-MISPLACED-01",
                    name="ThinkPad X1 Carbon",
                    expected_location="Server Room A",
                    audit_status="misplaced",
                )
            ],
        )

        resp = generate_signed_inventory_audit_pdf(req, user=self.user_a, db=self.db)
        self.assertEqual(resp.media_type, "application/pdf")
        self.assertTrue(resp.body.startswith(b"%PDF-"))
        self.assertEqual(misplaced_asset.location_id, loc_b.id)
        self.assertEqual(len(self.db.store.get(AssetDocument, [])), 1)


if __name__ == "__main__":
    unittest.main()
