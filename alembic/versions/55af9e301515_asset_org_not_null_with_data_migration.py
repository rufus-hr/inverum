"""asset_org_not_null_with_data_migration

Revision ID: 55af9e301515
Revises: 0ef970191587
Create Date: 2026-03-28 22:02:06.766555

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '55af9e301515'
down_revision: Union[str, Sequence[str], None] = '0ef970191587'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Backfill organization_id from import_job for any assets created during nullable window
    op.execute("""
        UPDATE assets a
        SET organization_id = ij.organization_id
        FROM import_jobs ij
        WHERE a.import_job_id = ij.id
          AND a.organization_id IS NULL
          AND ij.organization_id IS NOT NULL
    """)
    op.alter_column('assets', 'organization_id', existing_type=sa.UUID(), nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('assets', 'organization_id', existing_type=sa.UUID(), nullable=True)
