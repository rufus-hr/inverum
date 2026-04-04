"""work_orders_maintenance_integration

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-04-04

- Add work_orders table
- Add maintenance_schedules table
- Add external_services table
- Add integration_rules table (with GIN on conditions)
- Add integration_logs table
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_orders",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("number", sa.String(50), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("asset_id", sa.UUID(), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("assignee_type", sa.String(20), nullable=True),
        sa.Column("assignee_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("findings", sa.Text(), nullable=True),
        sa.Column("cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("cost_currency", sa.String(3), nullable=True),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("external_ticket_ref", sa.String(255), nullable=True),
        sa.Column("created_by_event", sa.UUID(), sa.ForeignKey("event_bus.id"), nullable=True),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_work_orders_tenant", "work_orders", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_work_orders_asset", "work_orders", ["asset_id"])
    op.create_index("idx_work_orders_status", "work_orders", ["status"])

    op.create_table(
        "maintenance_schedules",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("asset_id", sa.UUID(), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("asset_configuration_id", sa.UUID(),
                  sa.ForeignKey("asset_configurations.id"), nullable=True),
        sa.Column("location_id", sa.UUID(), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("asset_type_filter", sa.String(100), nullable=True),
        sa.Column("recurrence", sa.String(100), nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assignee_type", sa.String(20), nullable=True),
        sa.Column("assignee_id", sa.UUID(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_maintenance_schedules_tenant", "maintenance_schedules", ["tenant_id"])
    op.create_index("idx_maintenance_schedules_next_run", "maintenance_schedules", ["next_run_at"])

    op.create_table(
        "external_services",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("service_type", sa.String(50), nullable=False),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("auth_type", sa.String(20), nullable=False),
        sa.Column("credentials", JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_success", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_external_services_tenant", "external_services", ["tenant_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))

    op.create_table(
        "integration_rules",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("external_service_id", sa.UUID(),
                  sa.ForeignKey("external_services.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("trigger_event", sa.String(100), nullable=True),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("schedule", sa.String(100), nullable=True),
        sa.Column("url_template", sa.String(1000), nullable=False),
        sa.Column("payload_template", JSONB, nullable=True),
        sa.Column("response_mapping", JSONB, nullable=True),
        sa.Column("conditions", JSONB, nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("retry_backoff", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("circuit_breaker_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("circuit_breaker_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_integration_rules_service", "integration_rules", ["external_service_id"])
    op.create_index("idx_integration_rules_trigger", "integration_rules", ["trigger_event"])
    op.create_index("idx_integration_rules_conditions_gin", "integration_rules", ["conditions"],
                    postgresql_using="gin",
                    postgresql_ops={"conditions": "jsonb_path_ops"})

    op.create_table(
        "integration_logs",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("integration_rule_id", sa.UUID(),
                  sa.ForeignKey("integration_rules.id"), nullable=False),
        sa.Column("event_bus_id", sa.UUID(), sa.ForeignKey("event_bus.id"), nullable=True),
        sa.Column("request_payload", JSONB, nullable=True),
        sa.Column("response_payload", JSONB, nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_integration_logs_rule", "integration_logs", ["integration_rule_id"])
    op.create_index("idx_integration_logs_created", "integration_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_integration_logs_created", table_name="integration_logs")
    op.drop_index("idx_integration_logs_rule", table_name="integration_logs")
    op.drop_table("integration_logs")

    op.drop_index("idx_integration_rules_conditions_gin", table_name="integration_rules")
    op.drop_index("idx_integration_rules_trigger", table_name="integration_rules")
    op.drop_index("idx_integration_rules_service", table_name="integration_rules")
    op.drop_table("integration_rules")

    op.drop_index("idx_external_services_tenant", table_name="external_services")
    op.drop_table("external_services")

    op.drop_index("idx_maintenance_schedules_next_run", table_name="maintenance_schedules")
    op.drop_index("idx_maintenance_schedules_tenant", table_name="maintenance_schedules")
    op.drop_table("maintenance_schedules")

    op.drop_index("idx_work_orders_status", table_name="work_orders")
    op.drop_index("idx_work_orders_asset", table_name="work_orders")
    op.drop_index("idx_work_orders_tenant", table_name="work_orders")
    op.drop_table("work_orders")
