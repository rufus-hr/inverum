"""workspaces

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-03-31

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shared_desk_profiles",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("organization_id", sa.UUID(), sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("department_id", sa.UUID(), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_shared_desk_profiles_tenant",
        "shared_desk_profiles", ["tenant_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_shared_desk_profiles_location",
        "shared_desk_profiles", ["location_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "workspaces",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("assigned_to_user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("shared_desk_profile_id", sa.UUID(), sa.ForeignKey("shared_desk_profiles.id"), nullable=True),
        sa.Column("dxf_entity_id", sa.String(255), nullable=True),
        sa.Column("dxf_file_id", sa.UUID(), nullable=True),
        sa.Column("floor_plan_coordinates", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_workspaces_tenant",
        "workspaces", ["tenant_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_workspaces_location",
        "workspaces", ["location_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_workspaces_user",
        "workspaces", ["assigned_to_user_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_workspaces_profile",
        "workspaces", ["shared_desk_profile_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.execute("""
        CREATE VIEW shared_desk_availability AS
        SELECT
            sdp.id AS profile_id,
            sdp.name,
            sdp.capacity,
            COUNT(w.id) FILTER (WHERE w.assigned_to_user_id IS NOT NULL) AS occupied,
            sdp.capacity - COUNT(w.id) FILTER (WHERE w.assigned_to_user_id IS NOT NULL) AS available
        FROM shared_desk_profiles sdp
        LEFT JOIN workspaces w
            ON w.shared_desk_profile_id = sdp.id
            AND w.deleted_at IS NULL
        WHERE sdp.deleted_at IS NULL
        GROUP BY sdp.id, sdp.name, sdp.capacity
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS shared_desk_availability")
    op.drop_index("idx_workspaces_profile", table_name="workspaces")
    op.drop_index("idx_workspaces_user", table_name="workspaces")
    op.drop_index("idx_workspaces_location", table_name="workspaces")
    op.drop_index("idx_workspaces_tenant", table_name="workspaces")
    op.drop_table("workspaces")
    op.drop_index("idx_shared_desk_profiles_location", table_name="shared_desk_profiles")
    op.drop_index("idx_shared_desk_profiles_tenant", table_name="shared_desk_profiles")
    op.drop_table("shared_desk_profiles")
