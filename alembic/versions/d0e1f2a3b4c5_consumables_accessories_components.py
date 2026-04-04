"""consumables_accessories_components

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-04-04

- Add consumables table
- Add accessories table
- Add components table
- Add component_compatibility table
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "consumables",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("manufacturer_id", sa.UUID(), sa.ForeignKey("manufacturers.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("part_number", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False, server_default="pcs"),
        sa.Column("current_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minimum_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("linked_asset_id", sa.UUID(), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_consumables_tenant", "consumables", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    op.create_table(
        "accessories",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("manufacturer_id", sa.UUID(), sa.ForeignKey("manufacturers.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("part_number", sa.String(100), nullable=True),
        sa.Column("current_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("minimum_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("linked_asset_id", sa.UUID(), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("linked_user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_accessories_tenant", "accessories", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    op.create_table(
        "components",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("manufacturer_id", sa.UUID(), sa.ForeignKey("manufacturers.id"), nullable=True),
        sa.Column("part_number", sa.String(100), nullable=True),
        sa.Column("serial_number", sa.String(255), nullable=True),
        sa.Column("specs", JSONB, nullable=True),
        sa.Column("installed_in_type", sa.String(50), nullable=True),
        sa.Column("installed_in_id", sa.UUID(), nullable=True),
        sa.Column("parent_component_id", sa.UUID(), sa.ForeignKey("components.id"), nullable=True),
        sa.Column("installed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_components_tenant", "components", ["tenant_id"])
    op.create_index("idx_components_installed_in", "components",
                    ["installed_in_type", "installed_in_id"])
    op.create_index("idx_components_specs_gin", "components", ["specs"],
                    postgresql_using="gin",
                    postgresql_ops={"specs": "jsonb_path_ops"})

    op.create_table(
        "component_compatibility",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("component_id", sa.UUID(), sa.ForeignKey("components.id"), nullable=False),
        sa.Column("asset_configuration_id", sa.UUID(),
                  sa.ForeignKey("asset_configurations.id"), nullable=False),
        sa.Column("compatibility_type", sa.String(10), nullable=False),
        sa.Column("warning_message", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_component_compat_component", "component_compatibility", ["component_id"])
    op.create_index("idx_component_compat_config", "component_compatibility",
                    ["asset_configuration_id"])


def downgrade() -> None:
    op.drop_index("idx_component_compat_config", table_name="component_compatibility")
    op.drop_index("idx_component_compat_component", table_name="component_compatibility")
    op.drop_table("component_compatibility")

    op.drop_index("idx_components_specs_gin", table_name="components")
    op.drop_index("idx_components_installed_in", table_name="components")
    op.drop_index("idx_components_tenant", table_name="components")
    op.drop_table("components")

    op.drop_index("idx_accessories_tenant", table_name="accessories")
    op.drop_table("accessories")

    op.drop_index("idx_consumables_tenant", table_name="consumables")
    op.drop_table("consumables")
