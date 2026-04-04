"""boxes_plans_categories_events

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-04

New tables: asset_categories, asset_events, boxes, plans.
FK constraints on assets.category_id, assets.box_id, assets.plan_id.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- asset_categories ---
    op.create_table(
        "asset_categories",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("parent_id", sa.UUID(), sa.ForeignKey("asset_categories.id"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_asset_categories_tenant", "asset_categories", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_asset_categories_parent", "asset_categories", ["parent_id"])
    op.create_index("idx_asset_categories_sort", "asset_categories", ["tenant_id", "sort_order"])

    # --- boxes ---
    op.create_table(
        "boxes",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("inventory_number", sa.String(50), nullable=False),
        sa.Column("parent_box_id", sa.UUID(), sa.ForeignKey("boxes.id"), nullable=True),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("plan_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_boxes_tenant", "boxes", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_boxes_location", "boxes", ["location_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_boxes_parent", "boxes", ["parent_box_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_boxes_status", "boxes", ["tenant_id", "status"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    # --- plans ---
    op.create_table(
        "plans",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="planning"),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("canvas_session_id", sa.UUID(), nullable=True),
        sa.Column("external_project_ref", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("planned_start", sa.Date(), nullable=True),
        sa.Column("planned_end", sa.Date(), nullable=True),
        sa.Column("actual_end", sa.Date(), nullable=True),
        sa.Column("budget_planned", sa.Numeric(15, 2), nullable=True),
        sa.Column("budget_actual", sa.Numeric(15, 2), nullable=True),
        sa.Column("budget_currency", sa.String(3), nullable=True),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_plans_tenant", "plans", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_plans_status", "plans", ["tenant_id", "status"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_plans_location", "plans", ["location_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    # --- asset_events ---
    op.create_table(
        "asset_events",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("asset_id", sa.UUID(), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("actor_type", sa.String(20), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_name", sa.String(255), nullable=True),
        sa.Column("metadata", JSONB(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_asset_events_asset", "asset_events", ["asset_id", "created_at"])
    op.create_index("idx_asset_events_tenant", "asset_events", ["tenant_id", "created_at"])
    op.create_index("idx_asset_events_metadata_gin", "asset_events", ["metadata"],
                    postgresql_using="gin",
                    postgresql_ops={"metadata": "jsonb_path_ops"})

    # --- FK constraints on assets columns added in prev migration ---
    op.create_foreign_key("fk_assets_category_id", "assets", "asset_categories",
                          ["category_id"], ["id"])
    op.create_foreign_key("fk_assets_box_id", "assets", "boxes",
                          ["box_id"], ["id"])
    op.create_foreign_key("fk_assets_plan_id", "assets", "plans",
                          ["plan_id"], ["id"])

    # --- FK on boxes.plan_id now that plans exists ---
    op.create_foreign_key("fk_boxes_plan_id", "boxes", "plans",
                          ["plan_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_boxes_plan_id", "boxes", type_="foreignkey")
    op.drop_constraint("fk_assets_plan_id", "assets", type_="foreignkey")
    op.drop_constraint("fk_assets_box_id", "assets", type_="foreignkey")
    op.drop_constraint("fk_assets_category_id", "assets", type_="foreignkey")

    op.drop_index("idx_asset_events_metadata_gin", table_name="asset_events")
    op.drop_index("idx_asset_events_tenant", table_name="asset_events")
    op.drop_index("idx_asset_events_asset", table_name="asset_events")
    op.drop_table("asset_events")

    op.drop_index("idx_plans_location", table_name="plans")
    op.drop_index("idx_plans_status", table_name="plans")
    op.drop_index("idx_plans_tenant", table_name="plans")
    op.drop_table("plans")

    op.drop_index("idx_boxes_status", table_name="boxes")
    op.drop_index("idx_boxes_parent", table_name="boxes")
    op.drop_index("idx_boxes_location", table_name="boxes")
    op.drop_index("idx_boxes_tenant", table_name="boxes")
    op.drop_table("boxes")

    op.drop_index("idx_asset_categories_sort", table_name="asset_categories")
    op.drop_index("idx_asset_categories_parent", table_name="asset_categories")
    op.drop_index("idx_asset_categories_tenant", table_name="asset_categories")
    op.drop_table("asset_categories")
