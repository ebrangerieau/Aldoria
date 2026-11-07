"""Mondes indépendants de la classe : « jules » → « lumineux », « tom » → « brouillard »

Les identifiants portaient le prénom des premiers joueurs ; le monde (ambiance) est désormais
choisi par le parent, la classe ne fixe plus que le contenu (engine/levels.py).

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-13
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE profile SET world = 'lumineux' WHERE world = 'jules'")
    op.execute("UPDATE profile SET world = 'brouillard' WHERE world = 'tom'")


def downgrade() -> None:
    op.execute("UPDATE profile SET world = 'jules' WHERE world = 'lumineux'")
    op.execute("UPDATE profile SET world = 'tom' WHERE world = 'brouillard'")
