"""Erreurs du jeu remontées par les appareils (sans donnée d'enfant)

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-18
"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_error",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "family_id",
            sa.Integer,
            sa.ForeignKey("family.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("device_id", sa.Integer, sa.ForeignKey("device.id", ondelete="SET NULL")),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("platform", sa.String(80), nullable=False),
        sa.Column("scene", sa.String(120), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("count", sa.Integer, nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.UniqueConstraint("family_id", "fingerprint"),
    )


def downgrade() -> None:
    op.drop_table("client_error")
