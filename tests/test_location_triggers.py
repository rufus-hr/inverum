"""
Location Hierarchy & Container Cascade Tests (`T6.2`).
Verifies that moving a Box or StorageUnit to a new Location automatically updates
the effective location and breadcrumb path of all Assets inside it (`O(1)` container move),
and verifies security level violation detection (`ISO 27001 A.7.1 / A.7.8`).
"""
from __future__ import annotations

import unittest
import uuid
from unittest.mock import patch

from app.models.asset import Asset
from app.models.box import Box
from app.models.location import Location
from app.models.storage_unit import StorageUnit
from app.routers.storage_units import get_asset_location, place_asset, place_box
from app.schemas.storage_unit import PlaceInStorageUnit
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin


class TestLocationHierarchyAndCascades(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant, self.user, _ = create_test_tenant_and_admin(self.db)

        self.loc_zagreb = Location(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="NSC Zagreb",
            is_active=True,
            deleted_at=None,
        )
        self.loc_split = Location(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Logistički centar Split",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.loc_zagreb)
        self.db.add(self.loc_split)

        self.rack_zg = StorageUnit(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            location_id=self.loc_zagreb.id,
            parent_storage_unit_id=None,
            name="RACK-ZG-01",
            type="rack",
            security_level=3,
            is_lockable=True,
            deleted_at=None,
        )
        self.cabinet_split = StorageUnit(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            location_id=self.loc_split.id,
            parent_storage_unit_id=None,
            name="CAB-ST-01",
            type="cabinet",
            security_level=2,
            is_lockable=True,
            deleted_at=None,
        )
        self.db.add(self.rack_zg)
        self.db.add(self.cabinet_split)

        self.box = Box(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            inventory_number="BOX-2026-001",
            status="active",
            location_id=None,
            storage_unit_id=self.rack_zg.id,
            parent_box_id=None,
            deleted_at=None,
        )
        self.db.add(self.box)

        self.asset_in_box = Asset(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Zebra TC57 Scanner",
            serial_number="ZEB-TC57-001",
            security_level=2,
            box_id=self.box.id,
            storage_unit_id=None,
            location_id=None,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.asset_in_box)

    def test_moving_box_or_storage_unit_cascades_effective_location_to_assets(self) -> None:
        # 1. Initially Box is inside RACK-ZG-01 (NSC Zagreb)
        loc_info_1 = get_asset_location(self.asset_in_box.id, self.user, self.db)
        self.assertEqual(loc_info_1.effective_location_id, self.loc_zagreb.id)
        self.assertEqual(loc_info_1.effective_location_name, "NSC Zagreb")
        self.assertEqual(len(loc_info_1.breadcrumb), 3)
        self.assertEqual([b.name for b in loc_info_1.breadcrumb], ["NSC Zagreb", "RACK-ZG-01", "BOX-2026-001"])

        # 2. Move Box into CAB-ST-01 in Split -> Asset inside Box automatically resolves to Split!
        place_box(self.box.id, PlaceInStorageUnit(storage_unit_id=self.cabinet_split.id), self.user, self.db)
        loc_info_2 = get_asset_location(self.asset_in_box.id, self.user, self.db)
        self.assertEqual(loc_info_2.effective_location_id, self.loc_split.id)
        self.assertEqual(loc_info_2.effective_location_name, "Logistički centar Split")
        self.assertEqual([b.name for b in loc_info_2.breadcrumb], ["Logistički centar Split", "CAB-ST-01", "BOX-2026-001"])

        # 3. Relocate CAB-ST-01 itself back to Zagreb -> both Cabinet, Box, and Asset resolve to Zagreb
        self.cabinet_split.location_id = self.loc_zagreb.id
        loc_info_3 = get_asset_location(self.asset_in_box.id, self.user, self.db)
        self.assertEqual(loc_info_3.effective_location_id, self.loc_zagreb.id)

    @patch("app.routers.storage_units.event_bus_service.publish")
    def test_security_placement_violation_emits_event_and_warning(self, mock_publish) -> None:
        high_sec_asset = Asset(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="HSM Crypto Appliance",
            serial_number="HSM-999",
            security_level=5,
            is_active=True,
            deleted_at=None,
        )
        self.db.add(high_sec_asset)

        # Placing security_level=5 asset into security_level=2 cabinet triggers warning
        res = place_asset(
            high_sec_asset.id,
            PlaceInStorageUnit(storage_unit_id=self.cabinet_split.id),
            self.user,
            self.db,
        )
        self.assertEqual(res["status"], "ok")
        self.assertIn("warning", res)
        self.assertEqual(res["warning"]["code"], "security_placement_violation")
        mock_publish.assert_called_once()


if __name__ == "__main__":
    unittest.main()
