import unittest
import uuid

from app.models.asset import Asset
from app.models.asset_document import AssetDocument
from app.models.checklist_completion import ChecklistCompletion
from app.models.checklist_item import ChecklistItem
from app.models.checklist_template import ChecklistTemplate
from app.routers.checklists import _execute_pending_transition
from app.services import checklist_service
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin


class TestChecklistTransitionsAndAutoRevers(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant, self.admin, _ = create_test_tenant_and_admin(self.db)
        self.org_id = uuid.uuid4()

        # Create an active SOP template for onboarding (asset_stock_to_assigned)
        self.template = ChecklistTemplate(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="ISO A.8.1 & A.5.10 — Onboarding Hardening",
            trigger_event="asset_stock_to_assigned",
            asset_category=None,
            frequency="per_event",
            is_required=True,
            requires_confirmation=False,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.template)

        self.item1 = ChecklistItem(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            template_id=self.template.id,
            text="Enable BitLocker / LUKS Full-Disk Encryption",
            order_index=0,
            is_blocking=True,
            requires_note=True,
            depends_on_item_id=None,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.item1)

        self.asset = Asset(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            organization_id=self.org_id,
            name="ThinkPad T14s Gen 4",
            serial_number="SN-T14S-9001",
            mobility_type="personal",
            is_active=True,
            is_checklist_pending=False,
            deleted_at=None,
        )
        self.db.add(self.asset)

    def test_non_blocking_transition_sets_in_process_and_auto_generates_pades_revers(self) -> None:
        # 1. Trigger non-blocking drag & drop transition
        completions = checklist_service.trigger_event(
            db=self.db,
            event="asset_stock_to_assigned",
            asset=self.asset,
            pending_transition={
                "type": "assignment_change",
                "assigned_to_type": "user",
                "assigned_to_id": str(uuid.uuid4()),
            },
            triggered_by_user_id=self.admin.id,
        )

        self.assertEqual(len(completions), 1)
        self.assertTrue(self.asset.is_checklist_pending)
        completion = completions[0]
        self.assertEqual(completion.status, "open")

        # 2. Complete the mandatory blocking item with required note
        checklist_service.check_item(
            db=self.db,
            completion=completion,
            item=self.item1,
            checked_by=self.admin.id,
            note="BitLocker recovery key archived in Vault",
        )

        # 3. Submit completion -> should return True (all closed) and auto-generate PAdES-B-LTA Revers
        all_done = checklist_service.submit_completion(
            db=self.db,
            completion=completion,
            submitted_by=self.admin.id,
        )
        self.assertTrue(all_done)

        _execute_pending_transition(self.db, completion)
        self.assertFalse(self.asset.is_checklist_pending)

        docs = self.db.query(AssetDocument).all()
        self.assertEqual(len(docs), 1)
        revers_doc = docs[0]
        self.assertEqual(revers_doc.document_type, "handover")
        self.assertTrue(revers_doc.is_signed)
        self.assertIsNotNone(revers_doc.sha256_hash)
        self.assertIsNotNone(revers_doc.tsa_expires_at)


if __name__ == "__main__":
    unittest.main()
