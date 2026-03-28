"""audit_tables_and_confirmed_at

Revision ID: a1b2c3d4e5f6
Revises: 55af9e301515
Create Date: 2026-03-28 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '55af9e301515'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # confirmed_at on import_jobs
    op.add_column('import_jobs', sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))

    # auth_audit_log
    op.create_table(
        'auth_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('login_method', sa.String(50), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # data_audit_log
    op.create_table(
        'data_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('import_job_id', sa.UUID(), nullable=True),
        sa.Column('actor_type', sa.String(20), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('worker_task', sa.String(100), nullable=True),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('old_values', JSONB(), nullable=True),
        sa.Column('new_values', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['import_job_id'], ['import_jobs.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_data_audit_entity', 'data_audit_log', ['tenant_id', 'entity_type', 'entity_id'])
    op.create_index('idx_data_audit_import_job', 'data_audit_log', ['tenant_id', 'import_job_id'])
    op.create_index('idx_data_audit_org', 'data_audit_log', ['tenant_id', 'organization_id'])

    # access_audit_log
    op.create_table(
        'access_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_access_audit_user_time', 'access_audit_log', ['tenant_id', 'user_id', 'created_at'])

    # worker_audit_log
    op.create_table(
        'worker_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('import_job_id', sa.UUID(), nullable=True),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('worker_task', sa.String(100), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('details', JSONB(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['import_job_id'], ['import_jobs.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # sql_revert_log
    op.create_table(
        'sql_revert_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('import_job_id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('revert_data', JSONB(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['import_job_id'], ['import_jobs.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_sql_revert_job_seq', 'sql_revert_log', ['import_job_id', 'sequence'])
    op.create_index('idx_sql_revert_expires', 'sql_revert_log', ['expires_at'])


def downgrade() -> None:
    op.drop_index('idx_sql_revert_expires', 'sql_revert_log')
    op.drop_index('idx_sql_revert_job_seq', 'sql_revert_log')
    op.drop_table('sql_revert_log')
    op.drop_table('worker_audit_log')
    op.drop_index('idx_access_audit_user_time', 'access_audit_log')
    op.drop_table('access_audit_log')
    op.drop_index('idx_data_audit_org', 'data_audit_log')
    op.drop_index('idx_data_audit_import_job', 'data_audit_log')
    op.drop_index('idx_data_audit_entity', 'data_audit_log')
    op.drop_table('data_audit_log')
    op.drop_table('auth_audit_log')
    op.drop_column('import_jobs', 'confirmed_at')
