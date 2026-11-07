"""Pont des fractions (Jules) : un ravin à franchir avec des planches de longueurs fractionnaires
(`combat=False`, joué seulement au pont, tuile de la Citadelle ; le client dessine le ravin et
les planches d'après `visual`).

Le ravin mesure une fraction de perche ; Jules choisit des planches dans sa réserve et les pose
bout à bout. Le pont tient si leurs longueurs font exactement la largeur du ravin : toute
combinaison juste est acceptée (la réponse enregistrée est la somme des planches posées).
La réserve contient toujours au moins une solution, et des planches en trop.

- difficulté 1 : demis et quarts, ou un seul dénominateur (cinquièmes, huitièmes), ravin d'une
  perche au plus ;
- 2 : dénominateurs multiples l'un de l'autre (demis et huitièmes, tiers et sixièmes…) ;
- 3 : ravin de plus d'une perche, planches d'une perche et non unitaires (3/4, 2/3) ;
- 4 : dénominateurs qui ne sont pas multiples (demis et tiers, tiers et quarts) ;
- 5 : planches non unitaires de dénominateurs différents (2/3 et 3/4, 1/2 et 5/6…).
"""

from __future__ import annotations

import math
import random
from fractions import Fraction
from typing import Any

from app.engine.generators import Generator, register

F = Fraction
# Difficulté → (familles de planches, nombre de planches de la solution, ravin le plus large).
LEVELS: dict[int, tuple[list[list[Fraction]], tuple[int, int], Fraction]] = {
    1: ([[F(1, 2), F(1, 4)], [F(2, 5), F(1, 5)], [F(3, 8), F(1, 8)]], (2, 3), F(1)),
    2: (
        [[F(1, 2), F(1, 8), F(1, 4)], [F(1, 3), F(1, 6)], [F(1, 2), F(1, 6)], [F(1, 5), F(1, 10)]],
        (2, 3),
        F(1),
    ),
    3: (
        [[F(1), F(1, 2), F(3, 4), F(1, 4)], [F(1), F(2, 3), F(1, 3), F(1, 6)], [F(1), F(1, 2), F(3, 8)]],
        (2, 4),
        F(2),
    ),
    4: (
        [[F(1, 2), F(1, 3)], [F(1, 3), F(1, 4)], [F(1, 2), F(1, 3), F(1, 6)], [F(1, 2), F(1, 5)]],
        (2, 3),
        F(3, 2),
    ),
    5: (
        [[F(2, 3), F(3, 4), F(1, 2)], [F(1, 2), F(5, 6), F(1, 4)], [F(3, 4), F(1, 3), F(2, 3)],
         [F(2, 5), F(1, 2), F(3, 10)]],
        (2, 3),
        F(2),
    ),
}
NAMES = {2: "demis", 3: "tiers", 4: "quarts", 5: "cinquièmes", 6: "sixièmes", 8: "huitièmes",
         10: "dixièmes", 12: "douzièmes", 20: "vingtièmes", 24: "vingt-quatrièmes"}


def write(f: Fraction) -> str:
    return str(f.numerator) if f.denominator == 1 else f"{f.numerator}/{f.denominator}"


def measure(f: Fraction) -> str:
    """Largeur du ravin : « 5/6 de perche », « 1 perche », « 7/6 de perche (1 perche et 1/6) »."""
    text = short(f)
    if f > 1 and f.denominator > 1:
        whole = f.numerator // f.denominator
        text += f" ({whole} perche{'s' if whole > 1 else ''} et {write(f - whole)})"
    return text


def _lcm(fractions: list[Fraction]) -> int:
    return math.lcm(*(f.denominator for f in fractions))


def _mixed_denominators(planks: list[Fraction]) -> bool:
    """Au moins deux dénominateurs dont aucun n'est multiple de l'autre."""
    dens = sorted({p.denominator for p in planks})
    return any(b % a for i, a in enumerate(dens) for b in dens[i + 1:])


def _hint(kinds: list[Fraction]) -> str:
    common = _lcm(kinds)
    if common == 1:
        return "Additionne les longueurs des planches : il faut tomber juste sur la largeur du ravin."
    parts = [f"{write(k)} = {write(k * common)}/{common}" for k in kinds
             if k.denominator != common and k != 1]
    if any(k == 1 for k in kinds):
        parts.append(f"1 = {common}/{common}")
    name = NAMES.get(common, f"{common}e")
    return f"Compte tout en {name} : " + ", ".join(parts) + "."


def short(f: Fraction) -> str:
    """« 5/6 de perche », « 1 perche », « 2 perches »."""
    if f.denominator == 1:
        return f"{f.numerator} perche{'s' if f > 1 else ''}"
    return f"{write(f)} de perche"


def _explanation(solution: list[Fraction], gap: Fraction) -> str:
    terms = " + ".join(write(p) for p in solution)
    common = _lcm(solution)
    if all(p.denominator == common for p in solution):
        return f"Par exemple : {terms} = {short(gap)}."
    converted = " + ".join(f"{p.numerator * common // p.denominator}/{common}" for p in solution)
    total = f"{gap.numerator * common // gap.denominator}/{common}"
    if gap.denominator == 1:
        return f"Par exemple : {terms} = {converted} = {total} = {short(gap)}."
    end = "" if total == write(gap) else f" = {write(gap)}"
    return f"Par exemple : {terms} = {converted} = {total}{end} de perche."


def _pont(difficulty: int, rng: random.Random) -> dict[str, Any]:
    families, (low, high), widest = LEVELS[difficulty]
    while True:
        kinds = rng.choice(families)
        solution = sorted((rng.choice(kinds) for _ in range(rng.randint(low, high))), reverse=True)
        gap = sum(solution, F(0))
        if gap > widest or gap in kinds or (len(set(solution)) < 2 and difficulty > 1):
            continue
        if difficulty == 3 and gap <= 1:
            continue
        if difficulty >= 4 and not _mixed_denominators(solution):
            continue
        break
    stock = []
    for kind in sorted(kinds, reverse=True):
        needed = solution.count(kind)
        stock.append({"length": write(kind), "count": needed + rng.randint(1, 2)})
    return {
        "type": "numeric",
        "prompt": (
            f"Le ravin mesure {measure(gap)}. Pose bout à bout des planches qui font "
            f"exactement {short(gap)} en tout."
        ),
        "answer": {"kind": "fraction", "value": write(gap), "accept_equivalent": True},
        "hint": _hint(sorted(kinds, reverse=True)),
        "explanation": _explanation(solution, gap),
        "time_target_ms": 30000 + 8000 * difficulty,
        "game_modes": ["pont"],
        "visual": {"kind": "pont", "gap": write(gap), "planks": stock},
        "meta": {"solution": [write(p) for p in solution]},
    }


PONT = register(
    Generator(
        code="6e.fractions.pont",
        level="6e",
        notion="6e.maths.fractions.addition",
        role="chapitre",
        title="Pont des fractions",
        generate=_pont,
        combat=False,
    )
)
