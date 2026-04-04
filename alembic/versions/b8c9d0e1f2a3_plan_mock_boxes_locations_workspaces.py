"""plan_mock_boxes_locations_workspaces

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-04-04

- Add plan_mock_locations table (ephemeral location planning)
- Add plan_mock_boxes table (ephemeral box/pallet planning)
- Add plan_mock_workspaces table (ephemeral workspace planning)
All three are deleted with the plan; approved → converted to real entities.
"""
from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # plan_mock_locations — must come before boxes/workspaces (they FK to it)
    op.create_table(
        "plan_mock_locations",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("plan_id", sa.UUID(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("parent_mock_location_id", sa.UUID(),
                  sa.ForeignKey("plan_mock_locations.id"), nullable=True),
        sa.Column("real_parent_location_id", sa.UUID(),
                  sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("location_type", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("idx_plan_mock_locations_plan", "plan_mock_locations", ["plan_id"])

    # plan_mock_boxes
    op.create_table(
        "plan_mock_boxes",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("plan_id", sa.UUID(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("inventory_number", sa.String(50), nullable=False),
        sa.Column("parent_mock_box_id", sa.UUID(),
                  sa.ForeignKey("plan_mock_boxes.id"), nullable=True),
        sa.Column("type", sa.String(20), nullable=False, server_default="box"),
        sa.Column("mock_location_id", sa.UUID(),
                  sa.ForeignKey("plan_mock_locations.id"), nullable=True),
        sa.Column("real_location_id", sa.UUID(),
                  sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("estimated_asset_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("idx_plan_mock_boxes_plan", "plan_mock_boxes", ["plan_id"])

    # plan_mock_workspaces
    op.create_table(
        "plan_mock_workspaces",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("plan_id", sa.UUID(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(20), nullable=False, server_default="personal"),
        sa.Column("mock_location_id", sa.UUID(),
                  sa.ForeignKey("plan_mock_locations.id"), nullable=True),
        sa.Column("real_location_id", sa.UUID(),
                  sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("idx_plan_mock_workspaces_plan", "plan_mock_workspaces", ["plan_id"])


def downgrade() -> None:
    op.drop_index("idx_plan_mock_workspaces_plan", table_name="plan_mock_workspaces")
    op.drop_table("plan_mock_workspaces")

    op.drop_index("idx_plan_mock_boxes_plan", table_name="plan_mock_boxes")
    op.drop_table("plan_mock_boxes")

    op.drop_index("idx_plan_mock_locations_plan", table_name="plan_mock_locations")
    op.drop_table("plan_mock_locations")
