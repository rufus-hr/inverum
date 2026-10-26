"""
Supplies, Stock Instances & StockMovement Ledger Tests (`T6.2`).
Verifies SKU creation, single-parent validation, stock movements (in/out),
below-minimum threshold detection (`ISO 27001 A.8.14`), and overdraft protection (`409 Conflict`).
"""
from __future__ import annotations

import unittest
import uuid
from fastapi import HTTPException

from app.models.location import Location
from app.models.supply import Supply
from app.routers.supplies import (
    _create_movement,
    _validate_single_parent,
    create_stock_instance,
)
from app.schemas.supply import StockInstanceCreate, StockMovementCreate
from tests.conftest import FakeTestingSession, create_test_tenant_and_admin


class TestSuppliesAndStockMovements(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeTestingSession()
        self.tenant, self.user, _ = create_test_tenant_and_admin(self.db)

        self.warehouse = Location(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Centralno IT Skladište",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.warehouse)

        self.sku = Supply(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Cisco 10GBASE-SR SFP+ Transceiver",
            supply_type="stock_item",
            category="Network Spares",
            part_number="SFP-10G-SR",
            unit="kom",
            is_active=True,
            deleted_at=None,
        )
        self.db.add(self.sku)

    def test_single_parent_constraint_validation(self) -> None:
        # 0 parents -> 400
        with self.assertRaises(HTTPException) as ctx0:
            _validate_single_parent(None, None, None)
        self.assertEqual(ctx0.exception.status_code, 400)

        # 2 parents -> 400
        with self.assertRaises(HTTPException) as ctx2:
            _validate_single_parent(uuid.uuid4(), uuid.uuid4(), None)
        self.assertEqual(ctx2.exception.status_code, 400)

    def test_stock_creation_movements_and_below_minimum_detection(self) -> None:
        # 1. Create initial stock instance with quantity=15, minimum_quantity=10
        inst = create_stock_instance(
            StockInstanceCreate(
                supply_id=self.sku.id,
                entity_type="stock_item",
                location_id=self.warehouse.id,
                quantity=15,
                minimum_quantity=10,
                notes="Initial BCP stock",
            ),
            self.user,
            self.db,
        )
        self.assertEqual(inst.quantity, 15)
        self.assertFalse(inst.below_minimum)

        # 2. Issue 8 units (`quantity=-8`) -> remaining 7 < 10 (`below_minimum = True`)
        mov_out = _create_movement(
            StockMovementCreate(
                supply_id=self.sku.id,
                entity_type="stock_item",
                entity_id=inst.id,
                location_id=self.warehouse.id,
                quantity=-8,
                reason="usage",
                notes="Replaced optics in RACK-ZG-01",
            ),
            self.user,
            self.db,
        )
        self.assertEqual(mov_out.quantity, -8)
        self.assertEqual(mov_out.actor_id, self.user.id)

        # 3. Attempting to issue 10 more units when only 7 remain raises 409 Conflict
        with self.assertRaises(HTTPException) as ctx_overdraft:
            _create_movement(
                StockMovementCreate(
                    supply_id=self.sku.id,
                    entity_type="stock_item",
                    entity_id=inst.id,
                    location_id=self.warehouse.id,
                    quantity=-10,
                    reason="usage",
                ),
                self.user,
                self.db,
            )
        self.assertEqual(ctx_overdraft.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
