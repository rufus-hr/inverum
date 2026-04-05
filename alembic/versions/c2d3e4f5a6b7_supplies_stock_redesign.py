"""supplies + stock redesign: Supply model, StockPolicy/Movement rewrite,
Location.is_stock_location, WorkOrder.triggered_by_event_id, AssetEvent.diff

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-04

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. locations: is_stock_location ---
    op.add_column("locations", sa.Column(
        "is_stock_location", sa.Boolean(), nullable=False, server_default="false"
    ))

    # --- 2. supplies: nova tablica ---
    op.create_table(
        "supplies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("supply_type", sa.String(20), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False, server_default="kom"),
        sa.Column("compatible_with", sa.Text(), nullable=True),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("vendor_id", sa.UUID(), sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_supplies_tenant", "supplies", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_supplies_type", "supplies", ["tenant_id", "supply_type"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    # --- 3. stock_policies: rewrite ---
    # Drop stare constrainte i kolone, dodaj nove
    op.drop_column("stock_policies", "name")
    op.drop_column("stock_policies", "item_type")
    op.drop_column("stock_policies", "item_id")
    op.drop_column("stock_policies", "alert_threshold")
    op.drop_column("stock_policies", "reorder_quantity")

    op.add_column("stock_policies", sa.Column(
        "supply_id", sa.UUID(), sa.ForeignKey("supplies.id"), nullable=False,
        server_default=sa.text("gen_random_uuid()")  # placeholder za existing rows
    ))
    op.add_column("stock_policies", sa.Column(
        "location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=True
    ))
    op.add_column("stock_policies", sa.Column(
        "storage_unit_id", sa.UUID(), sa.ForeignKey("storage_units.id"), nullable=True
    ))
    op.add_column("stock_policies", sa.Column(
        "box_id", sa.UUID(), sa.ForeignKey("boxes.id"), nullable=True
    ))
    op.add_column("stock_policies", sa.Column(
        "minimum_quantity", sa.Integer(), nullable=True
    ))
    op.add_column("stock_policies", sa.Column(
        "reorder_quantity", sa.Integer(), nullable=True
    ))
    op.add_column("stock_policies", sa.Column(
        "reorder_period_months", sa.Integer(), nullable=True
    ))
    op.add_column("stock_policies", sa.Column(
        "deleted_at", sa.DateTime(timezone=True), nullable=True
    ))
    op.create_index("idx_stock_policies_supply", "stock_policies", ["supply_id"])
    # CHECK constraint — dodajemo tek kad su kolone tu
    op.create_check_constraint(
        "chk_stock_policy_single_parent", "stock_policies",
        "num_nonnulls(location_id, storage_unit_id, box_id) = 1"
    )

    # --- 4. stock_movements: rewrite ---
    op.drop_column("stock_movements", "stock_item_id")
    op.drop_column("stock_movements", "movement_type")
    op.drop_column("stock_movements", "performed_by")
    op.drop_column("stock_movements", "reference")

    op.add_column("stock_movements", sa.Column(
        "supply_id", sa.UUID(), sa.ForeignKey("supplies.id"), nullable=False,
        server_default=sa.text("gen_random_uuid()")
    ))
    op.add_column("stock_movements", sa.Column(
        "location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=True
    ))
    op.add_column("stock_movements", sa.Column(
        "storage_unit_id", sa.UUID(), sa.ForeignKey("storage_units.id"), nullable=True
    ))
    op.add_column("stock_movements", sa.Column(
        "box_id", sa.UUID(), sa.ForeignKey("boxes.id"), nullable=True
    ))
    op.add_column("stock_movements", sa.Column(
        "reason", sa.String(50), nullable=False, server_default="adjustment"
    ))
    op.add_column("stock_movements", sa.Column(
        "actor_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True
    ))
    op.add_column("stock_movements", sa.Column(
        "work_order_id", sa.UUID(), sa.ForeignKey("work_orders.id"), nullable=True
    ))
    op.add_column("stock_movements", sa.Column(
        "external_ref", sa.String(255), nullable=True
    ))
    op.create_index("idx_stock_movements_supply", "stock_movements", ["supply_id"])
    op.create_index("idx_stock_movements_tenant_created", "stock_movements",
                    ["tenant_id", "created_at"])
    op.create_check_constraint(
        "chk_stock_movement_single_parent", "stock_movements",
        "num_nonnulls(location_id, storage_unit_id, box_id) = 1"
    )

    # --- 5. work_orders: triggered_by_event_id ---
    op.add_column("work_orders", sa.Column(
        "triggered_by_event_id", sa.UUID(), sa.ForeignKey("event_bus.id"), nullable=True
    ))

    # --- 6. asset_events: diff JSONB ---
    op.add_column("asset_events", sa.Column(
        "diff", sa.dialects.postgresql.JSONB(), nullable=True
    ))


def downgrade() -> None:
    op.drop_column("asset_events", "diff")
    op.drop_column("work_orders", "triggered_by_event_id")

    op.drop_constraint("chk_stock_movement_single_parent", "stock_movements", type_="check")
    op.drop_index("idx_stock_movements_tenant_created", table_name="stock_movements")
    op.drop_index("idx_stock_movements_supply", table_name="stock_movements")
    op.drop_column("stock_movements", "external_ref")
    op.drop_column("stock_movements", "work_order_id")
    op.drop_column("stock_movements", "actor_id")
    op.drop_column("stock_movements", "reason")
    op.drop_column("stock_movements", "box_id")
    op.drop_column("stock_movements", "storage_unit_id")
    op.drop_column("stock_movements", "location_id")
    op.drop_column("stock_movements", "supply_id")
    op.add_column("stock_movements", sa.Column("stock_item_id", sa.UUID(), nullable=False,
                                               server_default=sa.text("gen_random_uuid()")))
    op.add_column("stock_movements", sa.Column("movement_type", sa.String(50), nullable=False,
                                               server_default="adjustment"))
    op.add_column("stock_movements", sa.Column("performed_by", sa.UUID(), nullable=False,
                                               server_default=sa.text("gen_random_uuid()")))
    op.add_column("stock_movements", sa.Column("reference", sa.String(100), nullable=True))

    op.drop_constraint("chk_stock_policy_single_parent", "stock_policies", type_="check")
    op.drop_index("idx_stock_policies_supply", table_name="stock_policies")
    op.drop_column("stock_policies", "deleted_at")
    op.drop_column("stock_policies", "reorder_period_months")
    op.drop_column("stock_policies", "reorder_quantity")
    op.drop_column("stock_policies", "minimum_quantity")
    op.drop_column("stock_policies", "box_id")
    op.drop_column("stock_policies", "storage_unit_id")
    op.drop_column("stock_policies", "location_id")
    op.drop_column("stock_policies", "supply_id")
    op.add_column("stock_policies", sa.Column("name", sa.String(255), nullable=False,
                                              server_default=""))
    op.add_column("stock_policies", sa.Column("item_type", sa.String(20), nullable=False,
                                              server_default="stock_item"))
    op.add_column("stock_policies", sa.Column("item_id", sa.UUID(), nullable=False,
                                              server_default=sa.text("gen_random_uuid()")))
    op.add_column("stock_policies", sa.Column("alert_threshold", sa.Integer(), nullable=False,
                                              server_default="0"))
    op.add_column("stock_policies", sa.Column("reorder_quantity", sa.Integer(), nullable=False,
                                              server_default="0"))

    op.drop_index("idx_supplies_type", table_name="supplies")
    op.drop_index("idx_supplies_tenant", table_name="supplies")
    op.drop_table("supplies")

    op.drop_column("locations", "is_stock_location")
