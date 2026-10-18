"""Registre des générateurs d'items (TRD §5.2).

Un générateur est une fonction pure, déterministe à graine fixée :
`generate(difficulty, rng) -> dict` (champs de l'item hors id, generator, seed).
"""

from __future__ import annotations

import random
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.engine.items import Item

GenerateFn = Callable[[int, random.Random], dict[str, Any]]


@dataclass(frozen=True)
class Generator:
    code: str
    level: str  # code de classe (engine/levels.py)
    notion: str
    role: str
    title: str
    generate: GenerateFn
    # Faux : réservé aux énigmes (widget dédié), jamais tiré pour un combat.
    combat: bool = True
    # Vrai : à graine égale, même document (relevé, tableau) à toutes les difficultés ;
    # seule la question change (enquêtes du village, plusieurs questions par document).
    shared_document: bool = False

    def item(self, difficulty: int, seed: int) -> Item:
        if not 1 <= difficulty <= 5:
            raise ValueError(f"difficulté hors bornes : {difficulty}")
        key = f"{self.code}:{seed}" if self.shared_document else f"{self.code}:{difficulty}:{seed}"
        rng = random.Random(key)
        fields = self.generate(difficulty, rng)
        return Item(
            id=f"{self.code}:{difficulty}:{seed}",
            difficulty=difficulty,
            notions=[self.notion],
            role=self.role,
            generator=self.code,
            seed=seed,
            **fields,
        )


REGISTRY: dict[str, Generator] = {}


def register(generator: Generator) -> Generator:
    if generator.code in REGISTRY:
        raise ValueError(f"générateur en double : {generator.code}")
    REGISTRY[generator.code] = generator
    return generator


def for_level(level: str) -> list[Generator]:
    return [g for g in REGISTRY.values() if g.level == level]


def for_notion(notion: str) -> list[Generator]:
    return [g for g in REGISTRY.values() if g.notion == notion]


def playable_notions() -> set[str]:
    """Notions couvertes par au moins un générateur."""
    return {g.notion for g in REGISTRY.values()}


def combat_notions() -> set[str]:
    """Notions qu'un paquet de combat peut poser : au moins un générateur hors énigme (une notion
    jouée seulement au tir ou dans une quête n'occupe pas de place vide dans le paquet)."""
    return {g.notion for g in REGISTRY.values() if g.combat}


# Enregistrement des générateurs (import pour effet de bord).
from app.engine.generators import (  # noqa: E402, F401
    algebre_2nde,
    anglais_2nde,
    anglais_6e,
    developper_2nde,
    enquetes,
    evolutions_2nde,
    fonctions_2nde,
    fractions_6e,
    francais_2nde_langue,
    francais_2nde_litterature,
    francais_6e_conjugaison,
    francais_6e_langue,
    francais_6e_lectures,
    geometrie_2nde,
    histoire_geo_2nde,
    histoire_geo_6e,
    interactifs,
    nombres_2nde,
    nombres_6e,
    prealgebre_6e,
    problemes_6e,
    raisonnement,
    tir,
)
