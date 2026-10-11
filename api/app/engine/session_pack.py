"""Paquet de session : items générés à partir des emplacements choisis par le
sélecteur (engine/selector.py), formules SVG intégrées.

Le client reçoit aussi `start_levels` (difficulté de départ par rôle) et ajuste
ensuite ±1 au fil des réponses de la session.
"""

from __future__ import annotations

import random
import statistics
from datetime import UTC, datetime
from typing import Any

from app.engine import selector
from app.engine.formulas import formula_hash, render_svg
from app.engine.generators import Generator, for_level, for_notion
from app.engine.items import Item


def build_items(slots: list[selector.Slot], rng: random.Random) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    formulas: dict[str, str] = {}
    for slot in slots:
        generators = [g for g in for_notion(slot.notion) if g.combat]
        if not generators:
            continue
        item = rng.choice(generators).item(slot.difficulty, rng.randrange(1_000_000_000))
        items.append(item_data(item, slot.category, formulas))
    return {"items": items, "formulas": formulas, "start_levels": _start_levels(items)}


def item_data(item: Item, category: str, formulas: dict[str, str]) -> dict[str, Any]:
    """Item tel qu'envoyé au client (sans `meta`), formule SVG ajoutée à `formulas`."""
    data = item.model_dump(exclude={"meta"})
    data["category"] = category
    if item.latex:
        key = formula_hash(item.latex)
        data["latex_hash"] = key
        if key not in formulas:
            formulas[key] = render_svg(item.latex)
    return data


# 3 premiers : un cran sous la maîtrise, au niveau, un cran au-dessus ; puis des
# items de secours (après une erreur) surtout proches du niveau.
ENIGMA_OFFSETS = [-1, 0, 1, -1, 0, 0, 1, 2, 0, -1, 1, 2]


def enigma_items(
    generator: Generator, mastery: float, count: int, rng: random.Random, formulas: dict
) -> list[dict[str, Any]]:
    """Items d'une énigme (rôle « enigme ») : difficulté croissante autour du niveau
    de maîtrise de la notion, du plus facile au plus difficile."""
    base = selector.base_difficulty(mastery)
    items = []
    for offset in sorted(ENIGMA_OFFSETS[:count]):
        difficulty = max(1, min(5, base + offset))
        item = generator.item(difficulty, rng.randrange(1_000_000_000))
        data = item_data(item, "enigme", formulas)
        data["role"] = "enigme"
        items.append(data)
    return items


def build(level: str, rng: random.Random) -> dict[str, Any]:
    """Paquet pour un joueur sans historique (tests du client, repli)."""
    notions = sorted({g.notion for g in for_level(level)})
    if not notions:
        raise ValueError(f"aucun générateur pour le niveau {level}")
    infos = [
        selector.NotionInfo(code=n, chapter=n.rsplit(".", 1)[0], automatism=_is_automatism(n))
        for n in notions
    ]
    slots = selector.select(infos, {}, {}, [], (0.5, 0.3, 0.2), datetime.now(UTC), rng)
    return build_items(slots, rng)


def _is_automatism(notion: str) -> bool:
    return any(g.role == "automatisme" for g in for_notion(notion))


def _start_levels(items: list[dict[str, Any]]) -> dict[str, int]:
    levels: dict[str, int] = {}
    for role in ("automatisme", "chapitre"):
        values = [i["difficulty"] for i in items if i["role"] == role]
        levels[role] = int(statistics.median_low(values)) if values else 1
    return levels
