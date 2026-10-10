"""Fractions, 6ème (programme cycle 3, arrêté du 10 avril 2025).

- additionner et soustraire deux fractions de même dénominateur, de dénominateurs
  multiples, puis non multiples dans des cas simples ;
- comparer des fractions (même dénominateur, même numérateur, dénominateurs
  multiples, comparaison à 1).
"""

from __future__ import annotations

import random
from fractions import Fraction
from math import lcm

from app.engine.generators import Generator, register
from app.engine.generators.formatting import frac_latex, frac_text

# Dénominateurs non multiples « simples » (petit dénominateur commun).
_SIMPLE_PAIRS = [(2, 3), (3, 4), (2, 5), (4, 6), (3, 5), (4, 10), (6, 8), (2, 7)]


# --- Addition et soustraction ---------------------------------------------------


def _numerator(rng: random.Random, den: int) -> int:
    """Numérateur entre 1 et 2×den, sans fraction égale à un entier (3/3, 8/4…)."""
    return rng.choice([n for n in range(1, 2 * den) if n % den != 0])


def _addition(difficulty: int, rng: random.Random) -> dict:
    subtract = difficulty in (2, 4) or (difficulty == 5 and rng.random() < 0.5)
    if difficulty <= 2:
        d = rng.randint(3, 10)
        d1 = d2 = d
    elif difficulty <= 4:
        d1 = rng.randint(2, 5)
        d2 = d1 * rng.randint(2, 4)
        if rng.random() < 0.5:
            d1, d2 = d2, d1
    else:
        d1, d2 = rng.choice(_SIMPLE_PAIRS)
        if rng.random() < 0.5:
            d1, d2 = d2, d1
    n1 = _numerator(rng, d1)
    n2 = _numerator(rng, d2)
    f1, f2 = Fraction(n1, d1), Fraction(n2, d2)
    if subtract and f1 < f2:
        n1, d1, n2, d2 = n2, d2, n1, d1
        f1, f2 = f2, f1
    if subtract and f1 == f2:
        n1 += 1 if (n1 + 1) % d1 else 2
        f1 = Fraction(n1, d1)
    result = f1 - f2 if subtract else f1 + f2
    sign = "-" if subtract else "+"
    common = lcm(d1, d2)

    if d1 == d2:
        hint = "Les dénominateurs sont égaux : on garde le dénominateur et on calcule avec les numérateurs."
        num = n1 - n2 if subtract else n1 + n2
        steps = f"{n1}/{d1} {sign} {n2}/{d2} = {num}/{d1}"
    else:
        if common in (d1, d2):
            small = d1 if d1 < d2 else d2
            hint = f"{common} est un multiple de {small} : transforme la fraction de dénominateur {small} pour avoir le dénominateur {common}."
        else:
            hint = f"Cherche un dénominateur commun à {d1} et {d2} (par exemple {common})."
        m1, m2 = n1 * (common // d1), n2 * (common // d2)
        num = m1 - m2 if subtract else m1 + m2
        parts = []
        if d1 != common:
            parts.append(f"{n1}/{d1} = {m1}/{common}")
        if d2 != common:
            parts.append(f"{n2}/{d2} = {m2}/{common}")
        steps = (
            f"On met au même dénominateur {common} : {' et '.join(parts)}. "
            f"Donc {m1}/{common} {sign} {m2}/{common} = {num}/{common}"
        )
    den_used = d1 if d1 == d2 else common
    if frac_text(result) != f"{num}/{den_used}":
        steps += f", soit {frac_text(result)} en simplifiant"
    explanation = steps + "."

    return {
        "type": "numeric",
        "prompt": "Calcule et donne le résultat sous forme de fraction.",
        "latex": f"{frac_latex(n1, d1)} {sign} {frac_latex(n2, d2)}",
        "answer": {"kind": "fraction", "value": frac_text(result), "accept_equivalent": True},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 15000 + 7000 * difficulty,
        "meta": {"n1": n1, "d1": d1, "n2": n2, "d2": d2, "op": sign},
    }


# --- Comparaison ----------------------------------------------------------------

COMPARE_CHOICES = ["<", "=", ">"]


def _comparison(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # même dénominateur
        d = rng.randint(3, 12)
        n1, n2 = rng.sample(range(1, 2 * d), 2)
        d1 = d2 = d
        rule = "Les dénominateurs sont égaux : la plus grande fraction est celle qui a le plus grand numérateur."
    elif difficulty == 2:  # même numérateur
        n = rng.randint(1, 9)
        d1, d2 = rng.sample(range(2, 13), 2)
        n1 = n2 = n
        rule = "Les numérateurs sont égaux : on partage en plus de parts quand le dénominateur est plus grand, donc chaque part est plus petite."
    elif difficulty == 3:  # dénominateurs multiples (égalité possible)
        d1 = rng.randint(2, 6)
        k = rng.randint(2, 3)
        d2 = d1 * k
        n1 = rng.randint(1, 2 * d1 - 1)
        n2 = n1 * k + rng.choice([-1, 0, 0, 1])
        n2 = max(1, n2)
        if rng.random() < 0.5:
            n1, d1, n2, d2 = n2, d2, n1, d1
        common = max(d1, d2)
        rule = f"On écrit les deux fractions avec le dénominateur {common}, puis on compare les numérateurs."
    elif difficulty == 4:  # comparaison à 1
        d1 = rng.randint(2, 12)
        n1 = d1 + rng.choice([-3, -2, -1, 0, 1, 2, 3])
        n1 = max(1, n1)
        n2 = d2 = 1
        rule = "Une fraction est plus grande que 1 quand son numérateur dépasse son dénominateur."
    else:  # dénominateurs non multiples simples
        d1, d2 = rng.choice(_SIMPLE_PAIRS)
        n1 = rng.randint(1, 2 * d1 - 1)
        n2 = rng.randint(1, 2 * d2 - 1)
        common = lcm(d1, d2)
        rule = f"On écrit les deux fractions avec le dénominateur {common}, puis on compare les numérateurs."

    f1, f2 = Fraction(n1, d1), Fraction(n2, d2)
    symbol = "<" if f1 < f2 else ("=" if f1 == f2 else ">")
    right_latex = "1" if difficulty == 4 else frac_latex(n2, d2)
    right_text = "1" if difficulty == 4 else f"{n2}/{d2}"
    if difficulty == 1:
        detail = f"Même dénominateur : on compare les numérateurs, {n1} {symbol} {n2}."
    elif difficulty == 2:
        detail = f"Même numérateur : {d1} parts sont {'plus petites' if d1 > d2 else 'plus grandes'} que {d2} parts."
    elif difficulty == 4:
        detail = f"Le numérateur {n1} est {'plus petit que' if n1 < d1 else ('égal au' if n1 == d1 else 'plus grand que')} le dénominateur {d1}."
    else:
        common = lcm(d1, d2)
        m1, m2 = n1 * (common // d1), n2 * (common // d2)
        parts = [f"{n}/{d} = {m}/{common}" for n, d, m in ((n1, d1, m1), (n2, d2, m2)) if d != common]
        detail = f"Avec le dénominateur {common} : {' et '.join(parts)}. On compare {m1} et {m2}."
    explanation = f"{detail} Donc {n1}/{d1} {symbol} {right_text}."
    return {
        "type": "mcq",
        "prompt": "Compare ces deux nombres.",
        "latex": f"{frac_latex(n1, d1)} \\quad \\square \\quad {right_latex}",
        "choices": COMPARE_CHOICES,
        "answer": {"kind": "choice", "index": COMPARE_CHOICES.index(symbol)},
        "hint": rule,
        "explanation": explanation,
        "time_target_ms": 8000 + 3000 * difficulty,
        "meta": {"n1": n1, "d1": d1, "n2": n2, "d2": d2},
    }


ADDITION = register(
    Generator(
        code="6e.fractions.addition",
        level="6e",
        notion="6e.maths.fractions.addition",
        role="chapitre",
        title="Additionner et soustraire des fractions",
        generate=_addition,
    )
)

COMPARISON = register(
    Generator(
        code="6e.fractions.comparaison",
        level="6e",
        notion="6e.maths.fractions.comparaison",
        role="automatisme",
        title="Comparer des fractions",
        generate=_comparison,
    )
)
