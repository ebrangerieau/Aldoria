"""Phase 1 : profils, sessions de jeu, tentatives

Revision ID: 0001
Revises:
Create Date: 2026-10-10
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

JSONType = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "profile",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(40), nullable=False, unique=True),
        sa.Column("avatar", sa.String(40), nullable=False),
        sa.Column("level", sa.String(8), nullable=False),
        sa.Column("world", sa.String(16), nullable=False),
        sa.Column("pin_hash", sa.String(200)),
        sa.Column("failed_logins", sa.Integer, nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("session_max_minutes", sa.Integer, nullable=False, server_default="25"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "game_session",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey("profile.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("active_seconds", sa.Integer),
        sa.Column("nb_questions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("nb_correct", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_game_session_profile_id", "game_session", ["profile_id"])
    op.create_table(
        "attempt",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey("profile.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id", sa.String(36), sa.ForeignKey("game_session.id", ondelete="CASCADE")
        ),
        sa.Column("item_id", sa.String(120), nullable=False),
        sa.Column("generator", sa.String(80)),
        sa.Column("difficulty", sa.Integer, nullable=False),
        sa.Column("notion_ids", JSONType, nullable=False),
        sa.Column("correct", sa.Boolean, nullable=False),
        sa.Column("time_ms", sa.Integer, nullable=False),
        sa.Column("hint_used", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("game_mode", sa.String(20), nullable=False, server_default="combat"),
        sa.Column("extra", JSONType, nullable=False, server_default="{}"),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_attempt_profile_id", "attempt", ["profile_id"])
    op.create_index("ix_attempt_session_id", "attempt", ["session_id"])


def downgrade() -> None:
    op.drop_table("attempt")
    op.drop_table("game_session")
    op.drop_table("profile")
