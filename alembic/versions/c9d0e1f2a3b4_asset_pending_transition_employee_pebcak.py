"""asset_pending_transition_employee_pebcak

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-04-04

- assets: add pending_transition JSONB (deferred operation during checklist)
- employees: add internal_notes, pebcak_score, internal_tags (IT admin only)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assets", sa.Column("pending_transition", JSONB, nullable=True))

    op.add_column("employees", sa.Column("internal_notes", sa.Text(), nullable=True))
    op.add_column("employees", sa.Column("pebcak_score", sa.Integer(), nullable=False,
                                         server_default="0"))
    op.add_column("employees", sa.Column("internal_tags", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "internal_tags")
    op.drop_column("employees", "pebcak_score")
    op.drop_column("employees", "internal_notes")
    op.drop_column("assets", "pending_transition")
