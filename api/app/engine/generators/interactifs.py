"""Générateurs des widgets interactifs (phase 3) : droite graduée (placer ou lire un
point), remettre dans l'ordre, lecture graphique.

`visual` décrit ce que le client dessine :
- number_line : {min, max, subdivisions (par unité), mode: place|read, point?: "a/b", label?}
- graph : {xmin, xmax, ymin, ymax, points: [[x, y], …]} (fonction affine par morceaux)
"""

from __future__ import annotations

import random
from decimal import Decimal
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.formatting import frac_text, minus, sentence
from app.engine.generators.nombres_6e import dec

# --- Droite graduée (6e) --------------------------------------------------------------------


def _number_line(difficulty: int, rng: random.Random) -> dict:
    """Niveaux 1 à 4 : placer une fraction (ou un décimal) ; niveau 5 : lire l'abscisse d'un point."""
    sub = rng.choice({1: [2, 4], 2: [3, 4, 5], 3: [10], 4: [3, 4, 6]}.get(difficulty, [3, 4, 5, 6]))
    start = 0 if difficulty <= 3 else rng.randint(1, 3)
    units = 2 if difficulty == 1 or sub == 10 else 3  # graduations assez larges pour le doigt
    end = start + units
    k = rng.randint(1, units * sub - 1)
    while k % sub == 0:  # jamais sur un entier : sinon on ne lit pas la graduation
        k = rng.randint(1, units * sub - 1)
    value = start + Fraction(k, sub)
    shown = (
        dec(Decimal(value.numerator) / Decimal(value.denominator))
        if sub == 10
        else f"{start * sub + k}/{sub}"
    )
    visual = {"kind": "number_line", "min": start, "max": end, "subdivisions": sub}
    explanation = (
        f"Chaque unité est partagée en {sub} : une graduation vaut 1/{sub}. "
        f"{shown} = {start} + {k}/{sub}, donc on compte {k} graduation{'s' if k > 1 else ''} après {start}"
        if start
        else f"Chaque unité est partagée en {sub} : une graduation vaut 1/{sub}. "
        f"{shown}, c'est {start * sub + k} graduation{'s' if k > 1 else ''} après 0"
    )
    if difficulty == 5:
        visual |= {"mode": "read", "point": frac_text(value), "label": "A"}
        return {
            "type": "numeric",
            "prompt": "Quel nombre repère le point A ? (fraction)",
            "answer": {"kind": "fraction", "value": frac_text(value), "accept_equivalent": True},
            "hint": "Combien de parts entre deux entiers ? Compte les graduations depuis l'entier juste avant A.",
            "explanation": sentence(
                f"Chaque unité est partagée en {sub}, A est à {k} graduations après {start} : "
                f"A = {start} + {k}/{sub} = {start * sub + k}/{sub}"
            ),
            "time_target_ms": 45000,
            "visual": visual,
            "meta": {"value": str(value), "sub": sub, "start": start},
        }
    visual["mode"] = "place"
    return {
        "type": "number_line",
        "prompt": f"Place le nombre {shown} sur la droite graduée.",
        "answer": {"kind": "fraction", "value": frac_text(value), "accept_equivalent": True},
        "hint": f"Entre deux entiers, il y a {sub} parts égales. Compte les graduations.",
        "explanation": sentence(explanation),
        "time_target_ms": 25000 + 7000 * difficulty,
        "visual": visual,
        "meta": {"value": str(value), "sub": sub, "start": start},
    }


# --- Remettre dans l'ordre ----------------------------------------------------------------------


def _order_item(prompt, labels, values, descending, hint, target_ms, meta) -> dict:
    order = sorted(range(len(values)), key=lambda i: values[i], reverse=descending)
    sign = " > " if descending else " < "
    return {
        "type": "order",
        "prompt": prompt,
        "choices": labels,
        "answer": {"kind": "order", "value": order},
        "hint": hint,
        "explanation": sentence(minus(sign.join(labels[i] for i in order))),
        "time_target_ms": target_ms,
        "meta": meta | {"values": [str(v) for v in values], "descending": descending},
    }


def _order_decimals(difficulty: int, rng: random.Random) -> dict:
    count = 4 if difficulty <= 2 else 5
    whole = rng.randint(0, 15)
    values: set[Decimal] = set()
    while len(values) < count:
        if difficulty == 1:
            v = Decimal(whole) + Decimal(rng.randint(1, 9)) / 10
        elif difficulty == 2:  # même partie entière, longueurs différentes (le piège)
            places = rng.choice([1, 2, 3])
            v = Decimal(whole) + Decimal(rng.randint(1, 10**places - 1)) / 10**places
        else:
            v = (
                Decimal(rng.randint(max(0, whole - 1), whole + 1))
                + Decimal(rng.randint(1, 999)) / 1000
            )
            if difficulty >= 4 and rng.random() < 0.3:
                v = Decimal(rng.randint(whole, whole + 1)) + Decimal(rng.randint(1, 9)) / 10
        values.add(v.normalize())
    values_list = list(values)
    rng.shuffle(values_list)
    descending = difficulty == 5 and rng.random() < 0.5
    return _order_item(
        f"Range ces nombres du plus {'grand au plus petit' if descending else 'petit au plus grand'} "
        "(touche-les dans l'ordre).",
        [dec(v) for v in values_list],
        values_list,
        descending,
        "Compare les parties entières, puis chiffre par chiffre après la virgule : 2,9 = 2,90 > 2,15.",
        20000 + 8000 * difficulty,
        {},
    )


def _order_reals(difficulty: int, rng: random.Random) -> dict:
    """Seconde : ranger des réels donnés sous des écritures variées (fraction, racine, π, puissance)."""
    pools = {
        1: [("1/2", 0.5), ("0,45", 0.45), ("3/5", 0.6), ("0,55", 0.55), ("2/5", 0.4)],
        2: [("√2", 2**0.5), ("1,4", 1.4), ("3/2", 1.5), ("1,42", 1.42), ("1,41", 1.41)],
        3: [("π", 3.14159265), ("22/7", 22 / 7), ("3,14", 3.14), ("√10", 10**0.5), ("3,2", 3.2)],
        4: [
            ("−1/3", -1 / 3),
            ("−0,3", -0.3),
            ("−√0,1", -(0.1**0.5)),
            ("−0,35", -0.35),
            ("−2/7", -2 / 7),
        ],
        5: [
            ("10⁻²", 0.01),
            ("1/90", 1 / 90),
            ("0,009", 0.009),
            ("0,1³", 0.001),
            ("1/120", 1 / 120),
        ],
    }
    chosen = rng.sample(pools[difficulty], 4)  # valeurs toutes distinctes : un seul ordre possible
    labels = [c[0] for c in chosen]
    values = [Fraction(c[1]).limit_denominator(10**7) for c in chosen]
    return _order_item(
        "Range ces réels du plus petit au plus grand (touche-les dans l'ordre).",
        labels,
        values,
        False,
        "Donne une valeur approchée de chacun (au centième, voire au millième) pour les comparer.",
        30000 + 8000 * difficulty,
        {"labels": labels},
    )


# --- Lecture graphique (2nde, automatisme) -------------------------------------------------------


def _curve(rng: random.Random, xmin: int, xmax: int) -> list[list[int]]:
    """Fonction affine par morceaux sur des points entiers (lecture sans ambiguïté)."""
    xs = sorted(rng.sample(range(xmin + 1, xmax), 3))
    xs = [xmin, *xs, xmax]
    ys = [rng.randint(-4, 4) for _ in xs]
    for i in range(1, len(ys)):
        while ys[i] == ys[i - 1]:
            ys[i] = rng.randint(-4, 4)
    return [[x, y] for x, y in zip(xs, ys, strict=True)]


def _value_at(points: list[list[int]], x: Fraction) -> Fraction:
    for (x1, y1), (x2, y2) in zip(points, points[1:], strict=False):
        if x1 <= x <= x2:
            return y1 + Fraction(y2 - y1, x2 - x1) * (x - x1)
    raise ValueError(x)


def _solutions(points: list[list[int]], k: int) -> list[Fraction]:
    """Abscisses où la courbe vaut k (segments non horizontaux : jamais d'infinité)."""
    found: set[Fraction] = set()
    for (x1, y1), (x2, y2) in zip(points, points[1:], strict=False):
        if min(y1, y2) <= k <= max(y1, y2):
            found.add(x1 + Fraction(k - y1, y2 - y1) * (x2 - x1))
    return sorted(found)


def _graph_reading(difficulty: int, rng: random.Random) -> dict:
    xmin, xmax = -5, 5
    while True:
        points = _curve(rng, xmin, xmax)
        if difficulty <= 2:  # image d'un sommet : lecture directe
            x0, y0 = rng.choice(points)
            break
        k = rng.randint(-3, 3)
        sols = _solutions(points, k)
        if difficulty >= 4 and not 1 <= len(sols) <= 3:
            continue
        if all(s.denominator == 1 for s in sols):  # lecture exacte sur le quadrillage
            break
    visual = {"kind": "graph", "xmin": xmin, "xmax": xmax, "ymin": -5, "ymax": 5, "points": points}
    base = {"visual": visual, "time_target_ms": 25000 + 8000 * difficulty}
    if difficulty <= 2:
        return base | {
            "type": "numeric",
            "prompt": minus(f"Voici la courbe de f. Lis l'image de {x0} par f."),
            "answer": {"kind": "number", "value": str(y0)},
            "hint": "Pars de l'abscisse sur l'axe horizontal, monte (ou descends) jusqu'à la courbe, puis lis l'ordonnée.",
            "explanation": sentence(
                minus(
                    f"Le point de la courbe d'abscisse {x0} a pour ordonnée {y0} : f({x0}) = {y0}"
                )
            ),
            "meta": {"points": points, "x": x0, "y": y0},
        }
    if difficulty == 3:  # nombre de solutions de f(x) = k
        count = len(sols)
        choices = ["0", "1", "2", "3", "4"]
        return base | {
            "type": "mcq",
            "prompt": minus(
                f"Voici la courbe de f. Combien de solutions a l'équation f(x) = {k} ?"
            ),
            "choices": choices,
            "answer": {"kind": "choice", "index": choices.index(str(count))},
            "hint": minus(
                f"Trace (dans ta tête) la droite horizontale y = {k} et compte ses points d'intersection avec la courbe."
            ),
            "explanation": sentence(
                minus(
                    f"La droite y = {k} ne coupe pas la courbe : aucune solution"
                    if count == 0
                    else f"La droite y = {k} coupe la courbe en {count} point{'s' if count > 1 else ''}, "
                    f"d'abscisses {', '.join(frac_text(s) for s in sols)}"
                )
            ),
            "meta": {"points": points, "k": k, "solutions": [str(s) for s in sols]},
        }
    # Niveaux 4 et 5 : le plus petit (ou le plus grand) antécédent de k.
    largest = difficulty == 5 and rng.random() < 0.5
    target = sols[-1] if largest else sols[0]
    return base | {
        "type": "numeric",
        "prompt": minus(
            f"Voici la courbe de f. Quel est le plus {'grand' if largest else 'petit'} antécédent de {k} par f ?"
        ),
        "answer": {"kind": "number", "value": frac_text(target)},
        "hint": minus(
            f"Les antécédents de {k} sont les abscisses des points de la courbe d'ordonnée {k}."
        ),
        "explanation": sentence(
            minus(
                f"La courbe passe à l'ordonnée {k} pour x = {', '.join(frac_text(s) for s in sols)} ; "
                f"le plus {'grand' if largest else 'petit'} est {frac_text(target)}"
            )
        ),
        "meta": {"points": points, "k": k, "solutions": [str(s) for s in sols], "largest": largest},
    }


NUMBER_LINE = register(
    Generator(
        code="6e.fractions.droite_graduee",
        level="6e",
        notion="6e.maths.fractions.droite_graduee",
        role="chapitre",
        title="Droite graduée",
        generate=_number_line,
    )
)
ORDER_DECIMALS = register(
    Generator(
        code="6e.nombres.ranger_decimaux",
        level="6e",
        notion="6e.maths.nombres.comparer_decimaux",
        role="chapitre",
        title="Ranger des décimaux",
        generate=_order_decimals,
    )
)
ORDER_REALS = register(
    Generator(
        code="2nde.reels.ranger",
        level="2nde",
        notion="2nde.maths.reels.ensembles",
        role="chapitre",
        title="Ranger des réels",
        generate=_order_reals,
    )
)
GRAPH_READING = register(
    Generator(
        code="2nde.automatismes.lecture_graphique",
        level="2nde",
        notion="2nde.maths.automatismes.lecture_graphique",
        role="automatisme",
        title="Lecture graphique",
        generate=_graph_reading,
    )
)
