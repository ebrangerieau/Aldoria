"""Phase 3 : espace parent complet (banque de questions, signalements, réinitialisation)

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-12
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("profile") as batch:
        batch.add_column(sa.Column("save_epoch", sa.Integer, nullable=False, server_default="0"))
    op.create_table(
        "bank_item",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("level", sa.String(8), nullable=False, index=True),
        sa.Column("notion", sa.String(120), nullable=False, index=True),
        sa.Column("difficulty", sa.Integer, nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("source", sa.String(12), nullable=False),
        sa.Column("data", JSON, nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "report",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey("profile.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("item_id", sa.String(120), nullable=False),
        sa.Column("item", JSON, nullable=False),
        sa.Column("user_input", sa.String(200), nullable=True),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("report")
    op.drop_table("bank_item")
    with op.batch_alter_table("profile") as batch:
        batch.drop_column("save_epoch")
