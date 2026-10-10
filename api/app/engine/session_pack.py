"""Composition d'un paquet de session (TRD §5.5, version prototype).

Phase 1, sans planificateur : pour chaque générateur du niveau, quelques items de
chaque difficulté. Le client choisit la difficulté au fil des réponses (zone de
progrès 70-85 %). Le planificateur Leitner et la maîtrise par notion arrivent en phase 2.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.formulas import formula_hash, render_svg
from app.engine.generators import for_level

ITEMS_PER_DIFFICULTY = 6


def build(level: str, rng: random.Random) -> dict[str, Any]:
    generators = for_level(level)
    if not generators:
        raise ValueError(f"aucun générateur pour le niveau {level}")
    items: list[dict[str, Any]] = []
    formulas: dict[str, str] = {}
    for generator in generators:
        for difficulty in range(1, 6):
            for _ in range(ITEMS_PER_DIFFICULTY):
                item = generator.item(difficulty, rng.randrange(1_000_000_000))
                data = item.model_dump(exclude={"meta"})
                if item.latex:
                    key = formula_hash(item.latex)
                    data["latex_hash"] = key
                    if key not in formulas:
                        formulas[key] = render_svg(item.latex)
                items.append(data)
    rng.shuffle(items)
    return {"items": items, "formulas": formulas}
