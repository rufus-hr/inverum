"""asset_org_nullable_importjob_org_id

Revision ID: 0ef970191587
Revises: 16a10fe1261d
Create Date: 2026-03-28 14:03:02.227294

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ef970191587'
down_revision: Union[str, Sequence[str], None] = '16a10fe1261d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('assets', 'organization_id', existing_type=sa.UUID(), nullable=True)
    op.add_column('import_jobs', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(None, 'import_jobs', 'organizations', ['organization_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'import_jobs', type_='foreignkey')
    op.drop_column('import_jobs', 'organization_id')
    op.alter_column('assets', 'organization_id', existing_type=sa.UUID(), nullable=False)
