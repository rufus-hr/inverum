"""
Tests for 4-Eyes Dual-Control Checklist Confirmation, Item Dependencies, and Multi-Tenant Isolation.
"""
from __future__ import annotations

import unittest
import uuid

from fastapi import HTTPException

from app.models.asset import Asset
from app.models.checklist_item import ChecklistItem
from app.models.checklist_template import ChecklistTemplate
from app.models.storage_unit import StorageUnit
from app.models.supply import Supply
from app.models.tenant import Tenant
from app.models.user import User
from app.routers.storage_units import get_storage_unit
from app.routers.supplies import get_supply
from app.services import checklist_service
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin


class TestFourEyesAndTenantIsolation(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant_a, self.user_a1, _ = create_test_tenant_and_admin(self.db)
        self.user_a2 = User(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            display_name="Second Approver (4-Eyes)",
            email="ciso@posta.hr",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.user_a2)

        self.tenant_b = Tenant(
            id=uuid.uuid4(),
            name="Other Tenant d.o.o.",
            slug="other-tenant",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.tenant_b)
        self.user_b = User(
            id=uuid.uuid4(),
            tenant_id=self.tenant_b.id,
            display_name="Other Tenant Admin",
            email="admin@other.hr",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.user_b)

    def test_four_eyes_rule_blocks_self_confirmation_and_allows_second_confirmer(self) -> None:
        tpl = ChecklistTemplate(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            name="NIST 800-88 Decommission & Media Destruction (4-Eyes)",
            trigger_event="asset.retire",
            requires_confirmation=True,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(tpl)

        step_1 = ChecklistItem(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            template_id=tpl.id,
            text="Verify cryptographic erase / degaussing serial number",
            order_index=1,
            is_blocking=True,
            requires_note=True,
            is_active=True,
            deleted_at=None,
        )
        step_2 = ChecklistItem(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            template_id=tpl.id,
            text="Attach physical destruction certificate reference",
            order_index=2,
            is_blocking=True,
            requires_note=False,
            depends_on_item_id=step_1.id,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(step_1)
        self.db.add(step_2)

        asset = Asset(
            id=uuid.uuid4(),
            tenant_id=self.tenant_a.id,
            organization_id=uuid.uuid4(),
            name="Classified Storage Array",
            serial_number="SN-SEC-900",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(asset)

        completions = checklist_service.trigger_event(
            db=self.db,
            event="asset.retire",
            asset=asset,
            pending_transition={"type": "status_change", "new_status_code": "retired"},
            triggered_by_user_id=self.user_a1.id,
        )
        self.assertEqual(len(completions), 1)
        comp = completions[0]
        self.assertTrue(asset.is_checklist_pending)

        # Dependency check: cannot check step_2 before step_1
        with self.assertRaises(ValueError):
            checklist_service.check_item(self.db, comp, step_2, self.user_a1.id, None)

        # Requires note check: step_1 requires a note
        with self.assertRaises(ValueError):
            checklist_service.check_item(self.db, comp, step_1, self.user_a1.id, None)

        checklist_service.check_item(self.db, comp, step_1, self.user_a1.id, "Degaussed via NIST 800-88 Purge")
        checklist_service.check_item(self.db, comp, step_2, self.user_a1.id, None)

        # Submit by user_a1: since requires_confirmation=True, returns False (awaits 4-eyes confirm)
        all_done_after_submit = checklist_service.submit_completion(self.db, comp, self.user_a1.id)
        self.assertFalse(all_done_after_submit)
        self.assertEqual(comp.status, "submitted")

        # 4-Eyes violation: user_a1 tries to confirm their own submission -> raises ValueError
        with self.assertRaises(ValueError) as ctx:
            checklist_service.confirm_completion(self.db, comp, self.user_a1.id)
        self.assertIn("4-eyes", str(ctx.exception).lower())

        # Second distinct user (user_a2) confirms -> succeeds and returns True
        all_done_after_confirm = checklist_service.confirm_completion(self.db, comp, self.user_a2.id)
        self.assertTrue(all_done_after_confirm)
        self.assertEqual(comp.status, "confirmed")
        self.assertEqual(comp.confirmed_by, self.user_a2.id)

    def test_multi_tenant_isolation_blocks_cross_tenant_access(self) -> None:
        su_b = StorageUnit(
            id=uuid.uuid4(),
            tenant_id=self.tenant_b.id,
            name="Tenant B Secret Vault",
            type="vault",
            security_level=5,
            is_lockable=True,
            deleted_at=None,
        )
        sup_b = Supply(
            id=uuid.uuid4(),
            tenant_id=self.tenant_b.id,
            name="Tenant B Private Supply",
            supply_type="consumable",
            unit="kom",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(su_b)
        self.db.add(sup_b)

        # User from Tenant A attempting to read Tenant B's StorageUnit or Supply receives 404
        with self.assertRaises(HTTPException) as su_ctx:
            get_storage_unit(su_b.id, user=self.user_a1, db=self.db)
        self.assertEqual(su_ctx.exception.status_code, 404)

        with self.assertRaises(HTTPException) as sup_ctx:
            get_supply(sup_b.id, user=self.user_a1, db=self.db)
        self.assertEqual(sup_ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
