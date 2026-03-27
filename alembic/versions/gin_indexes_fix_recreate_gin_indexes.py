"""recreate_gin_indexes_for_asset_relations

Revision ID: gin_indexes_fix
Revises: 71c57d552979
Create Date: 2026-03-27

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'gin_indexes_fix'
down_revision: Union[str, Sequence[str], None] = '71c57d552979'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('idx_assets_relations', 'assets', ['asset_relations'], postgresql_using='gin')
    op.create_index('idx_locations_default_relations', 'locations', ['default_asset_relations'], postgresql_using='gin')
    op.create_index('idx_organizations_default_relations', 'organizations', ['default_asset_relations'], postgresql_using='gin')


def downgrade() -> None:
    op.drop_index('idx_assets_relations', table_name='assets')
    op.drop_index('idx_locations_default_relations', table_name='locations')
    op.drop_index('idx_organizations_default_relations', table_name='organizations')
