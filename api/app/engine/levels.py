"""Classes (niveaux) et mondes : référentiel unique, de la 6e à la terminale.

Une classe n'est « disponible » que si son programme est chargé (content/seed/<classe>/) :
un enfant ne peut être inscrit que dans une classe disponible. Le monde (ambiance,
palette, compagnon) est indépendant de la classe : le parent le choisit, avec une
valeur par défaut selon le cycle.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter

LevelCode = Literal["6e", "5e", "4e", "3e", "2nde", "1ere", "term"]
WorldCode = Literal["lumineux", "brouillard"]


@dataclass(frozen=True)
class Level:
    code: str
    label: str
    cycle: str  # college | lycee


LEVELS: tuple[Level, ...] = (
    Level("6e", "6ème", "college"),
    Level("5e", "5ème", "college"),
    Level("4e", "4ème", "college"),
    Level("3e", "3ème", "college"),
    Level("2nde", "Seconde", "lycee"),
    Level("1ere", "Première", "lycee"),
    Level("term", "Terminale", "lycee"),
)
BY_CODE = {level.code: level for level in LEVELS}
WORLDS = {
    "lumineux": "Aldoria lumineuse (ton chaleureux, renard compagnon)",
    "brouillard": "Le Brouillard (ton sombre et épuré)",
}
AVATARS = {"lumineux": "renard", "brouillard": "loup"}


def label(code: str) -> str:
    level = BY_CODE.get(code)
    return level.label if level else code


def default_world(code: str) -> str:
    """Collège : le monde lumineux ; lycée : le Brouillard (modifiable par le parent)."""
    level = BY_CODE.get(code)
    return "brouillard" if level and level.cycle == "lycee" else "lumineux"


def earlier(code: str) -> list[str]:
    """Classes précédentes, de la plus récente à la plus ancienne (révisions de prérequis)."""
    codes = [level.code for level in LEVELS]
    if code not in codes:
        return []
    return list(reversed(codes[: codes.index(code)]))


async def available(db: AsyncSession) -> set[str]:
    """Classes dont le programme est chargé."""
    return set(await db.scalars(select(Chapter.level).distinct()))
