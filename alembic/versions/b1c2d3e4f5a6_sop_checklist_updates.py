"""sop_checklist_updates

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-31

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # checklist_items — add tenant_id, deleted_at, depends_on_item_id, updated_at
    op.add_column('checklist_items', sa.Column('tenant_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'checklist_items', 'tenants', ['tenant_id'], ['id'])
    # Backfill tenant_id from parent template
    op.execute("""
        UPDATE checklist_items ci
        SET tenant_id = ct.tenant_id
        FROM checklist_templates ct
        WHERE ci.template_id = ct.id
    """)
    op.alter_column('checklist_items', 'tenant_id', nullable=False)

    op.add_column('checklist_items', sa.Column('depends_on_item_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'checklist_items', 'checklist_items', ['depends_on_item_id'], ['id'])

    op.add_column('checklist_items', sa.Column(
        'updated_at', sa.DateTime(timezone=True), nullable=False,
        server_default=sa.func.now()
    ))
    op.add_column('checklist_items', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    # checklist_templates — add frequency, requires_confirmation
    op.add_column('checklist_templates', sa.Column(
        'frequency', sa.String(30), nullable=False, server_default='per_event'
    ))
    op.add_column('checklist_templates', sa.Column(
        'requires_confirmation', sa.Boolean(), nullable=False, server_default='false'
    ))
    # trigger_event column — expand to 100 chars
    op.alter_column('checklist_templates', 'trigger_event', type_=sa.String(100))

    # checklist_completions — full redesign
    op.add_column('checklist_completions', sa.Column(
        'status', sa.String(20), nullable=False, server_default='open'
    ))
    op.add_column('checklist_completions', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'checklist_completions', 'organizations', ['organization_id'], ['id'])
    op.add_column('checklist_completions', sa.Column('triggered_by_user_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'checklist_completions', 'users', ['triggered_by_user_id'], ['id'])
    op.add_column('checklist_completions', sa.Column('pending_transition', sa.dialects.postgresql.JSONB(), nullable=True))
    op.add_column('checklist_completions', sa.Column('submitted_by', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'checklist_completions', 'users', ['submitted_by'], ['id'])
    op.add_column('checklist_completions', sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('checklist_completions', sa.Column('confirmed_by', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'checklist_completions', 'users', ['confirmed_by'], ['id'])
    op.add_column('checklist_completions', sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('checklist_completions', sa.Column(
        'updated_at', sa.DateTime(timezone=True), nullable=False,
        server_default=sa.func.now()
    ))
    op.add_column('checklist_completions', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    # Make completed_by / completed_at nullable (collaborative model)
    op.alter_column('checklist_completions', 'completed_by', nullable=True)
    op.alter_column('checklist_completions', 'completed_at', nullable=True)
    # triggered_by — expand to 100 chars
    op.alter_column('checklist_completions', 'triggered_by', type_=sa.String(100))

    # assets — add is_checklist_pending
    op.add_column('assets', sa.Column(
        'is_checklist_pending', sa.Boolean(), nullable=False, server_default='false'
    ))

    # Indexes
    op.create_index(
        'idx_checklist_completions_asset_status',
        'checklist_completions', ['asset_id', 'status'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index(
        'idx_checklist_completions_tenant_status',
        'checklist_completions', ['tenant_id', 'status'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index(
        'idx_checklist_completions_employee_template',
        'checklist_completions', ['triggered_by_user_id', 'template_id', 'status'],
        postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index(
        'idx_assets_checklist_pending',
        'assets', ['tenant_id'],
        postgresql_where=sa.text('is_checklist_pending = TRUE'),
    )


def downgrade() -> None:
    op.drop_index('idx_assets_checklist_pending', table_name='assets')
    op.drop_index('idx_checklist_completions_employee_template', table_name='checklist_completions')
    op.drop_index('idx_checklist_completions_tenant_status', table_name='checklist_completions')
    op.drop_index('idx_checklist_completions_asset_status', table_name='checklist_completions')

    op.drop_column('assets', 'is_checklist_pending')

    op.drop_column('checklist_completions', 'deleted_at')
    op.drop_column('checklist_completions', 'updated_at')
    op.drop_column('checklist_completions', 'confirmed_at')
    op.drop_column('checklist_completions', 'confirmed_by')
    op.drop_column('checklist_completions', 'submitted_at')
    op.drop_column('checklist_completions', 'submitted_by')
    op.drop_column('checklist_completions', 'pending_transition')
    op.drop_column('checklist_completions', 'triggered_by_user_id')
    op.drop_column('checklist_completions', 'organization_id')
    op.drop_column('checklist_completions', 'status')

    op.drop_column('checklist_templates', 'requires_confirmation')
    op.drop_column('checklist_templates', 'frequency')

    op.drop_column('checklist_items', 'deleted_at')
    op.drop_column('checklist_items', 'updated_at')
    op.drop_column('checklist_items', 'depends_on_item_id')
    op.drop_column('checklist_items', 'tenant_id')
