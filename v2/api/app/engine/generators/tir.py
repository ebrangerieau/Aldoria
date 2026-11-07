"""Tir de précision à la Lice : des questions qui se résolvent en visant (`combat=False`, jouées
seulement au stand de tir ; le client dessine la scène d'après `visual`).

- `6e.angles.tir` (Jules) : un rapporteur géant au sol, la cible dans une direction ; on mesure
  l'angle entre la ligne de départ et la cible, en degrés. Aux difficultés 4 et 5, la ligne de
  départ est à gauche et le rapporteur porte ses deux graduations, comme un vrai : il faut lire
  celle qui commence à 0 de ce côté (l'erreur classique donne 180 − angle).
- `2nde.droites.tir` (Tom) : vue de côté dans un repère ; l'arbalète est sur l'axe des
  ordonnées en (0 ; b), la cible en (x ; y). On donne le coefficient directeur de la droite
  du carreau, a = (y − b) / x (entier, puis fraction, positif ou négatif).
"""

from __future__ import annotations

import math
import random
from fractions import Fraction
from typing import Any

from app.engine.generators import Generator, register

# Difficulté → (multiple de l'angle, petites graduations, nombres tous les…, ligne de départ à gauche).
ANGLES = {
    1: (30, 10, 30, False),
    2: (10, 10, 30, False),
    3: (5, 5, 10, False),
    4: (10, 10, 10, True),
    5: (5, 5, 10, True),
}


def _rapporteur(difficulty: int, rng: random.Random) -> dict[str, Any]:
    multiple, minor, labels, left = ANGLES[difficulty]
    angle = rng.choice([a for a in range(multiple, 180, multiple) if a != 90 or difficulty == 1])
    hint = (
        "Attention : la ligne de départ est à gauche. Lis la graduation qui vaut 0 de ce côté."
        if left
        else "Pars de la ligne de départ, à 0°, et compte les graduations jusqu'à la cible."
    )
    explanation = f"La cible est à {angle}° de la ligne de départ."
    if left:
        explanation += f" Sur l'autre graduation, on lit {180 - angle}° : c'est celle qui part de l'autre côté."
    return {
        "type": "numeric",
        "prompt": (
            "L'archer est au centre du rapporteur géant. Mesure l'angle entre la ligne de départ "
            "et la direction de la cible, en degrés."
        ),
        "answer": {"kind": "number", "value": str(angle)},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 20000 + 5000 * difficulty,
        "game_modes": ["tir"],
        "visual": {
            "kind": "rapporteur",
            "angle": angle,
            "reference": "gauche" if left else "droite",
            "minor": minor,
            "labels": labels,
            "double_scale": left,
            "distance": rng.choice([5.0, 5.5, 6.0]),
        },
        "meta": {"angle": angle, "trap": 180 - angle if left else None},
    }


TIR_ANGLE = register(
    Generator(
        code="6e.angles.tir",
        level="6e",
        notion="6e.maths.angles.mesure",
        role="chapitre",
        title="Tir au rapporteur",
        generate=_rapporteur,
        combat=False,
    )
)


BOARD_W, BOARD_H = 10, 8  # repère dessiné : x de 0 à 10, y de 0 à 8


def _slope_choices(difficulty: int) -> list[Fraction]:
    if difficulty == 1:
        return [Fraction(a) for a in (1, 2, 3)]
    if difficulty == 2:
        return [Fraction(a) for a in (1, 2, 3, -1, -2)]
    if difficulty == 3:
        return [Fraction(a) for a in (-3, -2, -1, 1, 2, 3)] + [Fraction(1, 2), Fraction(-1, 2)]
    denominators = (2, 3, 4) if difficulty == 4 else (2, 3, 4, 5)
    return [
        Fraction(p, q)
        for q in denominators
        for p in range(-4, 5)
        if p and math.gcd(p, q) == 1 and abs(Fraction(p, q)) <= 2
    ]


def _droite(difficulty: int, rng: random.Random) -> dict[str, Any]:
    while True:
        a = rng.choice(_slope_choices(difficulty))
        b = 0 if difficulty == 1 else rng.randint(0, 7)
        x = rng.choice([v for v in range(2, BOARD_W + 1) if v % a.denominator == 0])
        y = a * x + b
        if 0 <= y <= BOARD_H and y.denominator == 1 and y != b:
            break
    value = str(a.numerator) if a.denominator == 1 else f"{a.numerator}/{a.denominator}"
    rise = int(y) - b
    return {
        "type": "numeric",
        "prompt": (
            f"L'arbalète est en (0 ; {b}), la cible en ({x} ; {int(y)}). Le carreau part en "
            "ligne droite : quel est le coefficient directeur de sa droite ?"
        ),
        "answer": {"kind": "fraction", "value": value, "accept_equivalent": True},
        "hint": "Coefficient directeur : (variation de y) ÷ (variation de x), de l'arbalète à la cible.",
        "explanation": (
            f"De (0 ; {b}) à ({x} ; {int(y)}), y varie de {rise} quand x varie de {x} : "
            f"a = {rise}/{x} = {value}."
        ),
        "time_target_ms": 25000 + 6000 * difficulty,
        "game_modes": ["tir"],
        "visual": {
            "kind": "repere_tir",
            "start": [0, b],
            "target": [x, int(y)],
            "width": BOARD_W,
            "height": BOARD_H,
        },
        "meta": {"a": value, "b": b},
    }


TIR_DROITE = register(
    Generator(
        code="2nde.droites.tir",
        level="2nde",
        notion="2nde.maths.geometrie_reperee.droites",
        role="chapitre",
        title="Tir à l'arbalète",
        generate=_droite,
        combat=False,
    )
)
