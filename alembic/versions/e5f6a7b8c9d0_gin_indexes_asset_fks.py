"""gin_indexes_asset_fks

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-04

GIN indexes on all searchable JSONB columns.
asset.category_id and asset.box_id FK placeholders (tables created in next migration).
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- GIN indexes on JSONB columns ---

    # assets
    op.create_index(
        "idx_assets_custom_fields_gin", "assets", ["custom_fields"],
        postgresql_using="gin",
        postgresql_ops={"custom_fields": "jsonb_path_ops"},
    )
    op.create_index(
        "idx_assets_asset_relations_gin", "assets", ["asset_relations"],
        postgresql_using="gin",
        postgresql_ops={"asset_relations": "jsonb_path_ops"},
    )

    # event_bus
    op.create_index(
        "idx_event_bus_payload_gin", "event_bus", ["payload"],
        postgresql_using="gin",
        postgresql_ops={"payload": "jsonb_path_ops"},
    )

    # checklist_completions
    op.create_index(
        "idx_checklist_completions_pending_transition_gin",
        "checklist_completions", ["pending_transition"],
        postgresql_using="gin",
        postgresql_ops={"pending_transition": "jsonb_path_ops"},
    )

    # departments
    op.create_index(
        "idx_departments_asset_relations_gin", "departments", ["default_asset_relations"],
        postgresql_using="gin",
        postgresql_ops={"default_asset_relations": "jsonb_path_ops"},
    )

    # worker_audit_log
    op.create_index(
        "idx_worker_audit_log_metadata_gin", "worker_audit_log", ["metadata"],
        postgresql_using="gin",
        postgresql_ops={"metadata": "jsonb_path_ops"},
    )

    # --- asset.category_id + asset.box_id ---
    # Tables created in next migration — added as nullable with no FK for now,
    # FK constraints added after asset_categories and boxes tables exist.
    op.add_column("assets", sa.Column("category_id", sa.UUID(), nullable=True))
    op.add_column("assets", sa.Column("box_id", sa.UUID(), nullable=True))

    op.create_index("idx_assets_category", "assets", ["category_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_assets_box", "assets", ["box_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))


def downgrade() -> None:
    op.drop_index("idx_assets_box", table_name="assets")
    op.drop_index("idx_assets_category", table_name="assets")
    op.drop_column("assets", "box_id")
    op.drop_column("assets", "category_id")

    op.drop_index("idx_worker_audit_log_metadata_gin", table_name="worker_audit_log")
    op.drop_index("idx_departments_asset_relations_gin", table_name="departments")
    op.drop_index("idx_checklist_completions_pending_transition_gin", table_name="checklist_completions")
    op.drop_index("idx_event_bus_payload_gin", table_name="event_bus")
    op.drop_index("idx_assets_asset_relations_gin", table_name="assets")
    op.drop_index("idx_assets_custom_fields_gin", table_name="assets")
