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
    level: str  # « 6e » ou « 2nde »
    notion: str
    role: str
    title: str
    generate: GenerateFn

    def item(self, difficulty: int, seed: int) -> Item:
        if not 1 <= difficulty <= 5:
            raise ValueError(f"difficulté hors bornes : {difficulty}")
        rng = random.Random(f"{self.code}:{difficulty}:{seed}")
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


# Enregistrement des générateurs (import pour effet de bord).
from app.engine.generators import (  # noqa: E402, F401
    algebre_2nde,
    developper_2nde,
    evolutions_2nde,
    fractions_6e,
    geometrie_2nde,
    prealgebre_6e,
)
