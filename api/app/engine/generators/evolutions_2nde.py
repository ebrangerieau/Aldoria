"""Proportions et évolutions, seconde (arrêté du 26 février 2026), au format QCM
de la partie automatismes de l'épreuve anticipée de mathématiques.

Les distracteurs reprennent les erreurs classiques : confondre taux et coefficient,
additionner des taux successifs, croire qu'une baisse de t % compense une hausse de t %.
"""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.formatting import fr_number

_RATES = [2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75]
# Hausse t % → baisse qui ramène à la valeur initiale : t / (100 + t), valeurs « rondes ».
_RECIPROCALS = [(25, 20), (100, 50), (150, 60), (300, 75), (400, 80)]


def _pct(rate: Fraction) -> str:
    return f"{fr_number(rate * 100, 2)} %"


def _shuffle(rng: random.Random, correct: str, distractors: list[str]) -> tuple[list[str], int]:
    unique: list[str] = []
    for d in distractors:
        if d != correct and d not in unique:
            unique.append(d)
    choices = [correct, *unique[:3]]
    rng.shuffle(choices)
    return choices, choices.index(correct)


def _evolution(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # hausse → coefficient
        t = Fraction(rng.choice(_RATES), 100)
        correct = fr_number(1 + t)
        distractors = [fr_number(t), fr_number(1 - t), fr_number(1 + _misread(t)), fr_number(t * 100)]
        prompt = f"Augmenter une quantité de {_pct(t)} revient à la multiplier par :"
        explanation = f"Augmenter de {_pct(t)}, c'est multiplier par 1 + {fr_number(t)} = {correct}."
        hint = "Le coefficient multiplicateur d'une hausse de t % est 1 + t/100."
        meta = {"case": "hausse", "t": str(t)}
    elif difficulty == 2:  # baisse → coefficient
        t = Fraction(rng.choice(_RATES[:-1]), 100)
        correct = fr_number(1 - t)
        distractors = [fr_number(t), fr_number(1 + t), fr_number(1 - _misread(t)), fr_number(-t)]
        prompt = f"Diminuer une quantité de {_pct(t)} revient à la multiplier par :"
        explanation = f"Diminuer de {_pct(t)}, c'est multiplier par 1 − {fr_number(t)} = {correct}."
        hint = "Le coefficient multiplicateur d'une baisse de t % est 1 − t/100."
        meta = {"case": "baisse", "t": str(t)}
    elif difficulty == 3:  # coefficient → évolution
        t = Fraction(rng.choice(_RATES[:-2]), 100)
        up = rng.random() < 0.5
        c = 1 + t if up else 1 - t
        correct = f"une {'hausse' if up else 'baisse'} de {_pct(t)}"
        other = "baisse" if up else "hausse"
        distractors = [
            f"une {other} de {_pct(t)}",
            f"une {'hausse' if up else 'baisse'} de {_pct(c)}",
            f"une {other} de {_pct(c)}",
        ]
        prompt = f"Multiplier une quantité par {fr_number(c)} revient à appliquer :"
        explanation = (
            f"{fr_number(c)} = 1 {'+' if up else '−'} {fr_number(t)} : "
            f"c'est {correct}."
        )
        hint = "Compare le coefficient à 1 : au-dessus c'est une hausse, en dessous une baisse."
        meta = {"case": "coefficient", "c": str(c)}
    elif difficulty == 4:  # évolutions successives
        t1 = Fraction(rng.choice([10, 20, 25, 30, 40, 50]), 100)
        t2 = Fraction(rng.choice([10, 20, 25, 30, 40, 50]), 100)
        c = (1 + t1) * (1 - t2)
        rate = c - 1
        correct = _evolution_label(rate)
        distractors = [
            _evolution_label(t1 - t2),  # somme des taux : erreur classique
            _evolution_label(-rate) if rate != 0 else "une hausse de 1 %",
            _evolution_label(t1 * t2),
            _evolution_label(rate + Fraction(1, 100)),
        ]
        prompt = (
            f"Un prix augmente de {_pct(t1)}, puis baisse de {_pct(t2)}. "
            "Au total, le prix a subi :"
        )
        explanation = (
            f"On multiplie les coefficients : {fr_number(1 + t1)} × {fr_number(1 - t2)} = {fr_number(c)}, "
            f"soit {correct}. On n'additionne pas les pourcentages."
        )
        hint = "Multiplie les coefficients multiplicateurs des deux évolutions."
        meta = {"case": "successives", "t1": str(t1), "t2": str(t2)}
    else:  # évolution réciproque
        up, down = rng.choice(_RECIPROCALS)
        t = Fraction(up, 100)
        correct = f"{down} %"
        distractors = [f"{up} %", f"{100 - down} %", f"{fr_number(Fraction(up, 2), 0)} %", f"{down + 5} %"]
        prompt = (
            f"Un prix augmente de {up} %. De quel pourcentage doit-il baisser "
            "pour revenir à sa valeur initiale ?"
        )
        explanation = (
            f"Le coefficient réciproque de {fr_number(1 + t)} est 1 / {fr_number(1 + t)} = "
            f"{fr_number(1 / (1 + t))}, soit une baisse de {down} %."
        )
        hint = "Cherche le coefficient c tel que c × (1 + t) = 1."
        meta = {"case": "reciproque", "up": up, "down": down}

    choices, index = _shuffle(rng, correct, distractors)
    return {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": index},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 10000 + 5000 * difficulty,
        "meta": meta,
    }


def _misread(t: Fraction) -> Fraction:
    """Erreur d'ordre de grandeur : 3 % lu 0,3 (petits taux), 15 % lu 1,5 % (grands taux)."""
    return t * 10 if t < Fraction(1, 10) else t / 10


def _evolution_label(rate: Fraction) -> str:
    if rate == 0:
        return "aucune évolution"
    return f"une {'hausse' if rate > 0 else 'baisse'} de {_pct(abs(rate))}"


EVOLUTIONS = register(
    Generator(
        code="2nde.automatismes.evolutions",
        level="2nde",
        notion="2nde.maths.automatismes.evolutions",
        role="automatisme",
        title="Coefficients multiplicateurs et évolutions",
        generate=_evolution,
    )
)
