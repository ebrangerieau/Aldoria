"""Plusieurs familles : familles, comptes adultes, invitations, appareils reliés

La famille existante devient la n° 1 (« Ma famille », à renommer dans l'espace parent) :
ses enfants, sa banque de questions et ses décisions « au programme / hors programme »
lui sont rattachés. Les comptes adultes se créent ensuite par invitation
(`python -m app.cli invite --family 1 --operator`).

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-12
"""

import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _when(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def _family_fk(nullable: bool = False) -> sa.Column:
    return sa.Column(
        "family_id",
        sa.Integer,
        sa.ForeignKey("family.id", ondelete="CASCADE"),
        nullable=nullable,
        index=True,
    )


def upgrade() -> None:
    op.create_table(
        "family",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        _when("created_at"),
    )
    op.execute("INSERT INTO family (id, name, created_at) VALUES (1, 'Ma famille', now())")
    op.execute("SELECT setval(pg_get_serial_sequence('family', 'id'), 1)")

    # Enfants et banque : rattachés à la famille n° 1.
    for table in ("profile", "bank_item"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("family_id", sa.Integer, nullable=True))
        op.execute(f"UPDATE {table} SET family_id = 1")
        with op.batch_alter_table(table) as batch:
            batch.alter_column("family_id", nullable=False)
            batch.create_foreign_key(
                f"fk_{table}_family", "family", ["family_id"], ["id"], ondelete="CASCADE"
            )
            batch.create_index(f"ix_{table}_family_id", ["family_id"])
    with op.batch_alter_table("profile") as batch:
        # Un prénom est unique dans une famille, plus sur tout le serveur.
        batch.drop_constraint("profile_name_key", type_="unique")
        batch.create_unique_constraint("uq_profile_family_name", ["family_id", "name"])

    # Décisions « au programme / hors programme » : par famille.
    op.create_table(
        "family_notion",
        sa.Column(
            "family_id",
            sa.Integer,
            sa.ForeignKey("family.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "notion_id",
            sa.Integer,
            sa.ForeignKey("notion.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("in_program", sa.Boolean, nullable=False),
    )
    op.execute(
        "INSERT INTO family_notion (family_id, notion_id, in_program) "
        "SELECT 1, id, in_program FROM notion WHERE in_program IS NOT NULL"
    )
    with op.batch_alter_table("notion") as batch:
        batch.drop_column("in_program")

    op.create_table(
        "adult",
        sa.Column("id", sa.Integer, primary_key=True),
        _family_fk(),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("is_operator", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("failed_logins", sa.Integer, nullable=False, server_default="0"),
        _when("locked_until", nullable=True),
        _when("created_at"),
        _when("last_login_at", nullable=True),
    )
    op.create_table(
        "adult_session",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "adult_id",
            sa.Integer,
            sa.ForeignKey("adult.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String(120), nullable=False),
        _when("created_at"),
        _when("expires_at"),
        _when("last_seen_at"),
    )
    op.create_table(
        "invitation",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("kind", sa.String(14), nullable=False),
        _family_fk(nullable=True),
        sa.Column("adult_id", sa.Integer, sa.ForeignKey("adult.id", ondelete="CASCADE")),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("adult.id", ondelete="SET NULL")),
        sa.Column("note", sa.String(80), nullable=False),
        sa.Column("operator", sa.Boolean, nullable=False, server_default=sa.false()),
        _when("created_at"),
        _when("expires_at"),
        _when("used_at", nullable=True),
    )
    op.create_table(
        "device",
        sa.Column("id", sa.Integer, primary_key=True),
        _family_fk(),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(60), nullable=False),
        _when("created_at"),
        _when("last_seen_at", nullable=True),
    )
    op.create_table(
        "pairing_code",
        sa.Column("id", sa.String(64), primary_key=True),
        _family_fk(),
        sa.Column("device_name", sa.String(60), nullable=False),
        _when("created_at"),
        _when("expires_at"),
        _when("used_at", nullable=True),
    )


def downgrade() -> None:
    for table in ("pairing_code", "device", "invitation", "adult_session", "adult"):
        op.drop_table(table)
    with op.batch_alter_table("notion") as batch:
        batch.add_column(sa.Column("in_program", sa.Boolean, nullable=True))
    op.execute(
        "UPDATE notion SET in_program = fn.in_program FROM family_notion fn "
        "WHERE fn.notion_id = notion.id AND fn.family_id = 1"
    )
    op.drop_table("family_notion")
    # Retour à une seule famille : les enfants des autres familles sont effacés.
    op.execute("DELETE FROM profile WHERE family_id <> 1")
    op.execute("DELETE FROM bank_item WHERE family_id <> 1")
    with op.batch_alter_table("profile") as batch:
        batch.drop_constraint("uq_profile_family_name", type_="unique")
        batch.create_unique_constraint("profile_name_key", ["name"])
    for table in ("profile", "bank_item"):
        with op.batch_alter_table(table) as batch:
            batch.drop_index(f"ix_{table}_family_id")
            batch.drop_constraint(f"fk_{table}_family", type_="foreignkey")
            batch.drop_column("family_id")
    op.drop_table("family")
