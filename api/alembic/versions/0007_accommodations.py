"""Phase 3 : aménagements d'accessibilité par enfant (troubles « dys »)

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-12
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("profile") as batch:
        batch.add_column(sa.Column("accommodations", JSON, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("profile") as batch:
        batch.drop_column("accommodations")
