"""asset_identifiers_stock_policies_alerts_box_fks

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-04

- Rebuild asset_identifiers table (type + value + label + unique constraint)
- Add stock_policies table
- Add alert_events table
- Add box_id FK to stock_items, consumables, accessories
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rebuild asset_identifiers (was simpler before, now has proper structure)
    op.drop_table("asset_identifiers")
    op.create_table(
        "asset_identifiers",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("asset_id", sa.UUID(), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("identifier_type", sa.String(30), nullable=False),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "identifier_type", "value",
                            name="uq_asset_identifiers_tenant_type_value"),
    )
    op.create_index("idx_asset_identifiers_asset", "asset_identifiers", ["asset_id"])
    op.create_index("idx_asset_identifiers_value", "asset_identifiers",
                    ["identifier_type", "value"])

    # stock_policies
    op.create_table(
        "stock_policies",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("item_type", sa.String(20), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("alert_threshold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reorder_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("responsible_user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("idx_stock_policies_tenant", "stock_policies", ["tenant_id"])

    # alert_events
    op.create_table(
        "alert_events",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("alert_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("idx_alert_events_tenant", "alert_events", ["tenant_id"])
    op.create_index("idx_alert_events_unack", "alert_events",
                    ["tenant_id", "acknowledged_at"])

    # box_id FK on stock_items, consumables, accessories
    op.add_column("stock_items",
                  sa.Column("box_id", sa.UUID(), sa.ForeignKey("boxes.id"), nullable=True))
    op.add_column("consumables",
                  sa.Column("box_id", sa.UUID(), sa.ForeignKey("boxes.id"), nullable=True))
    op.add_column("accessories",
                  sa.Column("box_id", sa.UUID(), sa.ForeignKey("boxes.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("accessories", "box_id")
    op.drop_column("consumables", "box_id")
    op.drop_column("stock_items", "box_id")

    op.drop_index("idx_alert_events_unack", table_name="alert_events")
    op.drop_index("idx_alert_events_tenant", table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index("idx_stock_policies_tenant", table_name="stock_policies")
    op.drop_table("stock_policies")

    op.drop_index("idx_asset_identifiers_value", table_name="asset_identifiers")
    op.drop_index("idx_asset_identifiers_asset", table_name="asset_identifiers")
    op.drop_table("asset_identifiers")
    # Note: downgrade recreates old asset_identifiers structure is not done here
    # as the old table structure is superseded
