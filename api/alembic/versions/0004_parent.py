"""Phase 2 : espace parent (décision sur les notions à valider)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("notion") as batch:
        batch.add_column(sa.Column("in_program", sa.Boolean, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("notion") as batch:
        batch.drop_column("in_program")
