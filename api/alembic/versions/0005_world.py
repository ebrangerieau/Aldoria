"""Phase 3 : mode de jeu de chaque session et note de plaisir de fin de donjon

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("game_session") as batch:
        batch.add_column(sa.Column("mode", sa.String(20), nullable=True))
        batch.add_column(sa.Column("rating", sa.Integer, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("game_session") as batch:
        batch.drop_column("rating")
        batch.drop_column("mode")
