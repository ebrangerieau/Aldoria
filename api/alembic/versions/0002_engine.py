"""Phase 2 : programme, statut des chapitres, suivi par notion, mélange de session

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("profile") as batch:
        batch.add_column(sa.Column("ratio_chapter", sa.Float, nullable=False, server_default="0.5"))
        batch.add_column(sa.Column("ratio_review", sa.Float, nullable=False, server_default="0.3"))
        batch.add_column(
            sa.Column("ratio_automatisms", sa.Float, nullable=False, server_default="0.2")
        )

    op.create_table(
        "subject",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("label", sa.String(60), nullable=False),
    )
    op.create_table(
        "chapter",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "subject_id",
            sa.Integer,
            sa.ForeignKey("subject.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("level", sa.String(8), nullable=False),
        sa.Column("code", sa.String(80), nullable=False, unique=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_chapter_level", "chapter", ["level"])
    op.create_table(
        "notion",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "chapter_id",
            sa.Integer,
            sa.ForeignKey("chapter.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(120), nullable=False, unique=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("is_automatism", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("to_validate", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_notion_chapter_id", "notion", ["chapter_id"])
    op.create_table(
        "chapter_status",
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey("profile.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "chapter_id",
            sa.Integer,
            sa.ForeignKey("chapter.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="a_venir"),
        sa.Column("test_date", sa.Date),
    )
    op.create_table(
        "notion_state",
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
        sa.Column("box", sa.Integer, nullable=False, server_default="1"),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("mastery", sa.Float, nullable=False, server_default="0"),
        sa.Column("seen", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_seen", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("notion_state")
    op.drop_table("chapter_status")
    op.drop_table("notion")
    op.drop_table("chapter")
    op.drop_table("subject")
    with op.batch_alter_table("profile") as batch:
        batch.drop_column("ratio_automatisms")
        batch.drop_column("ratio_review")
        batch.drop_column("ratio_chapter")
