"""add_description_to_departments

Revision ID: 16a10fe1261d
Revises: gin_indexes_fix
Create Date: 2026-03-28 00:01:11.424598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16a10fe1261d'
down_revision: Union[str, Sequence[str], None] = 'gin_indexes_fix'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('departments', sa.Column('description', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('departments', 'description')
