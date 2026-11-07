"""Notions mises de côté pour un enfant (pas encore vues en classe)

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-18
"""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notion_aside",
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey("profile.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "notion_id",
            sa.Integer,
            sa.ForeignKey("notion.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("notion_aside")
