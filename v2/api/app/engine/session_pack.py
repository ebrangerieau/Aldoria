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

from app.engine import selector, speech
from app.engine.formulas import formula_hash, render_svg
from app.engine.generators import Generator, for_level, for_notion
from app.engine.items import Item

# Part des emplacements confiés à une question de la banque quand la notion en a une
# de difficulté proche (les générateurs gardent l'essentiel : variété infinie).
BANK_SHARE = 0.4


def build_items(
    slots: list[selector.Slot],
    rng: random.Random,
    bank: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Items des emplacements. `bank` : questions publiées de la banque par notion
    (champs d'un Item, `id` compris) ; une même question au plus une fois par paquet."""
    items: list[dict[str, Any]] = []
    formulas: dict[str, str] = {}
    used: set[str] = set()
    for slot in slots:
        generators = [g for g in for_notion(slot.notion) if g.combat]
        written = [
            entry
            for entry in (bank or {}).get(slot.notion, [])
            if abs(entry["difficulty"] - slot.difficulty) <= 1 and entry["id"] not in used
        ]
        if written and (not generators or rng.random() < BANK_SHARE):
            entry = rng.choice(written)
            used.add(entry["id"])
            items.append(item_data(Item(**entry), slot.category, formulas))
            continue
        if not generators:
            continue
        item = rng.choice(generators).item(slot.difficulty, rng.randrange(1_000_000_000))
        items.append(item_data(item, slot.category, formulas))
    return {"items": items, "formulas": formulas, "start_levels": _start_levels(items)}


def item_data(item: Item, category: str, formulas: dict[str, str]) -> dict[str, Any]:
    """Item tel qu'envoyé au client (sans `meta`), formule SVG ajoutée à `formulas`."""
    data = item.model_dump(exclude={"meta"})
    data["category"] = category
    data["speech"] = speech.for_item(data)
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
    de maîtrise de la notion, du plus facile au plus difficile.

    Générateur à document partagé (enquêtes) : par groupes de trois questions sur un
    même document, de difficultés consécutives (une quête = un groupe)."""
    base = selector.base_difficulty(mastery)
    if generator.shared_document:
        start = max(1, min(3, base - 1))
        plan = []
        for _ in range(-(-count // 3)):
            seed = rng.randrange(1_000_000_000)
            plan += [(start + k, seed) for k in range(3)]
        plan = plan[:count]
    else:
        offsets = sorted(ENIGMA_OFFSETS[:count])
        plan = [(max(1, min(5, base + o)), rng.randrange(1_000_000_000)) for o in offsets]
    items = []
    for difficulty, seed in plan:
        item = generator.item(difficulty, seed)
        data = item_data(item, "enigme", formulas)
        data["role"] = "enigme"
        items.append(data)
    return items


def build(level: str, rng: random.Random) -> dict[str, Any]:
    """Paquet pour un joueur sans historique (tests du client, repli)."""
    # Notions qu'un combat peut poser (pas celles des seuls jeux dédiés : stand de tir, enquêtes).
    notions = sorted({g.notion for g in for_level(level) if g.combat})
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
