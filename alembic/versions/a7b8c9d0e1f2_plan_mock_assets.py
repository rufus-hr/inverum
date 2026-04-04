"""plan_mock_assets

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-04

- Remove plan_id from assets (mock assets are ephemeral, live in plan_mock_assets)
- Add plan_mock_assets table
- Remove fk_assets_plan_id constraint added in previous migration
"""
from alembic import op
import sqlalchemy as sa

revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Revert plan_id from assets — mock assets don't belong in the main table
    op.drop_constraint("fk_assets_plan_id", "assets", type_="foreignkey")
    op.drop_column("assets", "plan_id")

    op.create_table(
        "plan_mock_assets",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("plan_id", sa.UUID(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("category_id", sa.UUID(), sa.ForeignKey("asset_categories.id"), nullable=True),
        sa.Column("type_name", sa.String(100), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("estimated_unit_cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_plan_mock_assets_plan", "plan_mock_assets", ["plan_id"])


def downgrade() -> None:
    op.drop_index("idx_plan_mock_assets_plan", table_name="plan_mock_assets")
    op.drop_table("plan_mock_assets")
    op.add_column("assets", sa.Column("plan_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_assets_plan_id", "assets", "plans", ["plan_id"], ["id"])
