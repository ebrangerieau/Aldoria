"""Pré-algèbre, 6ème : la balance (programme cycle 3 2025, « initiation à la pensée
algébrique » par les balances).

Une balance équilibrée porte des boîtes identiques de masse inconnue et des billes.
On cherche la masse d'une boîte, en raisonnant comme sur la balance : enlever la
même chose des deux côtés, puis partager.
"""

from __future__ import annotations

import random

from app.engine.generators import Generator, register
from app.engine.generators.formatting import sentence

ITEMS = [("boîte", "boîtes", "bille", "billes"), ("sac", "sacs", "pièce", "pièces")]


def _count(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


def _balance(difficulty: int, rng: random.Random) -> dict:
    box, boxes, unit, units = rng.choice(ITEMS)
    x = rng.randint(2, 6 if difficulty <= 2 else 12)
    left_boxes, left_units, right_boxes = 1, 0, 0
    if difficulty == 1:  # x + a = b
        left_units = rng.randint(1, 9)
    elif difficulty == 2:  # k·x = b
        left_boxes = rng.randint(2, 5)
    elif difficulty <= 4:  # k·x + a = b
        left_boxes = rng.randint(2, 5 if difficulty == 3 else 8)
        left_units = rng.randint(1, 15)
    else:  # k·x + a = m·x + b
        right_boxes = rng.randint(1, 3)
        left_boxes = right_boxes + rng.randint(1, 4)
        left_units = rng.randint(1, 10)
    right_units = left_boxes * x + left_units - right_boxes * x

    left = _count(left_boxes, box, boxes)
    if left_units:
        left += f" et {_count(left_units, unit, units)}"
    right = _count(right_units, unit, units)
    if right_boxes:
        right = f"{_count(right_boxes, box, boxes)} et {right}"
    prompt = (
        f"Une balance est en équilibre. À gauche : {left}. À droite : {right}. "
        f"Toutes les {boxes} ont la même masse. Combien de {units} pèse une {box} ?"
        if box == "boîte"
        else f"Une balance est en équilibre. À gauche : {left}. À droite : {right}. "
        f"Tous les {boxes} ont la même masse. Combien de {units} pèse un {box} ?"
    )

    steps = []
    boxes_left, units_right = left_boxes, right_units
    if right_boxes:
        boxes_left -= right_boxes
        steps.append(f"on enlève {_count(right_boxes, box, boxes)} de chaque côté")
    if left_units:
        units_right -= left_units
        steps.append(f"on enlève {_count(left_units, unit, units)} de chaque côté")
    situation = (
        f"il reste {_count(boxes_left, box, boxes)} contre {_count(units_right, unit, units)}"
    )
    if boxes_left > 1:
        conclusion = (
            f"donc une {box} pèse {units_right} ÷ {boxes_left} = {x} {units}"
            if box == "boîte"
            else f"donc un {box} pèse {units_right} ÷ {boxes_left} = {x} {units}"
        )
    else:
        conclusion = (
            f"donc une {box} pèse {x} {units}"
            if box == "boîte"
            else f"donc un {box} pèse {x} {units}"
        )
    explanation = sentence(", ".join([*steps, situation, conclusion]))

    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": "number", "value": str(x)},
        "hint": "Comme sur une balance : enlève la même chose des deux côtés pour qu'elle reste en équilibre.",
        "explanation": explanation,
        "time_target_ms": 30000 + 10000 * difficulty,  # 40 s à 80 s
        "game_modes": ["combat", "enigme"],
        "meta": {
            "x": x,
            "left_boxes": left_boxes,
            "left_units": left_units,
            "right_boxes": right_boxes,
            "right_units": right_units,
        },
    }


BALANCE = register(
    Generator(
        code="6e.prealgebre.balance",
        level="6e",
        notion="6e.maths.prealgebre.balance",
        role="chapitre",
        title="Balances (valeur inconnue)",
        generate=_balance,
    )
)
