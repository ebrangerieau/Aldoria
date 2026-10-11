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
from app.engine.generators import for_level, for_notion


def build_items(slots: list[selector.Slot], rng: random.Random) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    formulas: dict[str, str] = {}
    for slot in slots:
        generators = for_notion(slot.notion)
        if not generators:
            continue
        item = rng.choice(generators).item(slot.difficulty, rng.randrange(1_000_000_000))
        data = item.model_dump(exclude={"meta"})
        data["category"] = slot.category
        if item.latex:
            key = formula_hash(item.latex)
            data["latex_hash"] = key
            if key not in formulas:
                formulas[key] = render_svg(item.latex)
        items.append(data)
    return {"items": items, "formulas": formulas, "start_levels": _start_levels(items)}


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
