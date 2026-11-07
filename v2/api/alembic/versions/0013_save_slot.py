"""Sauvegarde de partie par emplacement : jeu v1 (Godot) et jeu v2 (Babylon.js)

Les deux jeux partagent la base pendant la transition (v2/docs/TRD.md §6) : chaque
emplacement garde ses propres révisions. Les sauvegardes existantes deviennent « v1 ».

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-07
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "save_revision",
        sa.Column("slot", sa.String(8), nullable=False, server_default="v1"),
    )
    op.drop_constraint("save_revision_pkey", "save_revision", type_="primary")
    op.create_primary_key("save_revision_pkey", "save_revision", ["profile_id", "slot", "revision"])


def downgrade() -> None:
    # Les parties v2 n'existent pas pour le jeu v1 : on les retire avant de revenir en arrière.
    op.execute("DELETE FROM save_revision WHERE slot <> 'v1'")
    op.drop_constraint("save_revision_pkey", "save_revision", type_="primary")
    op.create_primary_key("save_revision_pkey", "save_revision", ["profile_id", "revision"])
    op.drop_column("save_revision", "slot")
