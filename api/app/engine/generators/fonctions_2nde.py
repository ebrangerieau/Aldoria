"""Fonctions, équations, statistiques, probabilités et algorithmique, seconde
(arrêté du 26 février 2026) : image d'un nombre, fonction affine passant par deux
points, coefficient directeur, équation produit nul, moyenne pondérée, probabilités
conditionnelles (tableau croisé, arbre pondéré), Pythagore (automatisme), lecture
de code Python.
"""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.developper_2nde import _pretty, poly_text
from app.engine.generators.formatting import fr_number, frac_text, minus, p, sentence


def _numeric(prompt, value, hint, explanation, target_ms, meta, kind="number", latex=None) -> dict:
    item = {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": kind, "value": value},
        "hint": hint,
        "explanation": sentence(minus(explanation)),
        "time_target_ms": target_ms,
        "meta": meta,
    }
    if kind == "fraction":
        item["answer"]["accept_equivalent"] = True
    if latex:
        item["latex"] = latex
    return item


def _mcq(prompt, correct, distractors, hint, explanation, target_ms, rng, meta, latex=None) -> dict:
    choices = [correct]
    for d in distractors:
        if d not in choices:
            choices.append(d)
    choices = choices[:4]
    rng.shuffle(choices)
    item = {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(correct)},
        "hint": hint,
        "explanation": sentence(minus(explanation)),
        "time_target_ms": target_ms,
        "meta": meta,
    }
    if latex:
        item["latex"] = latex
    return item


def _nonzero(rng: random.Random, low: int, high: int) -> int:
    return rng.choice([v for v in range(low, high + 1) if v != 0])


# --- Image d'un nombre ------------------------------------------------------------------


def _image(difficulty: int, rng: random.Random) -> dict:
    x = rng.randint(-5, 5)
    if difficulty == 1:
        coeffs = {1: _nonzero(rng, -6, 6), 0: rng.randint(-9, 9)}
    elif difficulty <= 3:
        coeffs = {
            2: 1 if difficulty == 2 else _nonzero(rng, -3, 3),
            1: rng.randint(-6, 6),
            0: rng.randint(-9, 9),
        }
    else:
        coeffs = {2: _nonzero(rng, -3, 3), 1: rng.randint(-6, 6), 0: rng.randint(-9, 9)}
        x = _nonzero(rng, -4, 4)
    coeffs = {k: v for k, v in coeffs.items() if v != 0}
    value = sum(c * x**k for k, c in coeffs.items())
    expr = minus(_pretty(poly_text(coeffs)))
    detail = ""
    for k, c in sorted(coeffs.items(), reverse=True):
        mag = abs(c)
        factor = "" if mag == 1 else f"{mag} × "
        body = {2: f"{factor}{p(x)}²", 1: f"{factor}{p(x)}", 0: str(mag)}[k]
        if not detail:
            detail = ("−" if c < 0 else "") + body
        else:
            detail += (" − " if c < 0 else " + ") + body
    return _numeric(
        f"Soit f(x) = {expr}. Calcule l'image de {minus(str(x))} par f.",
        str(value),
        "Remplace x par le nombre, entre parenthèses s'il est négatif. Le carré passe avant la multiplication.",
        f"f({x}) = {detail} = {value}",
        20000 + 8000 * difficulty,
        {"coeffs": {str(k): v for k, v in coeffs.items()}, "x": x, "value": value},
    )


# --- Fonction affine passant par deux points ---------------------------------------------------


def _affine(difficulty: int, rng: random.Random) -> dict:
    a = _nonzero(rng, -5, 5)
    b = rng.randint(-9, 9)
    x1 = 0 if difficulty == 1 else rng.randint(-4, 3)  # niveau 1 : f(0) = b se lit directement
    x2 = x1 + rng.randint(1, 4)
    y1, y2 = a * x1 + b, a * x2 + b
    if difficulty <= 2:  # coefficient directeur seul
        return _numeric(
            minus(
                f"f est une fonction affine telle que f({x1}) = {y1} et f({x2}) = {y2}. "
                "Quel est son coefficient directeur a ?"
            ),
            str(a),
            "a = (f(x₂) − f(x₁)) ÷ (x₂ − x₁) : l'accroissement des images divisé par celui des abscisses.",
            f"a = ({y2} − {p(y1)}) ÷ ({x2} − {p(x1)}) = {y2 - y1} ÷ {x2 - x1} = {a}",
            35000,
            {"a": a, "b": b, "points": [[x1, y1], [x2, y2]]},
        )
    expression = poly_text({k: v for k, v in {1: a, 0: b}.items() if v != 0})
    return {
        "type": "expression",
        "prompt": minus(
            f"f est affine, avec f({x1}) = {y1} et f({x2}) = {y2}. Donne l'expression de f(x)."
        ),
        "answer": {"kind": "expression", "value": expression, "variable": "x"},
        "hint": "Calcule d'abord a = (f(x₂) − f(x₁)) ÷ (x₂ − x₁), puis b avec un des deux points.",
        "explanation": sentence(
            minus(
                f"a = ({y2} − {p(y1)}) ÷ ({x2} − {p(x1)}) = {a} ; puis b = f({x1}) − a × {p(x1)} = {y1} − {p(a)} × {p(x1)} = {b}, "
                f"donc f(x) = {_pretty(expression)}"
            )
        ),
        "time_target_ms": 45000 + 10000 * difficulty,
        "meta": {"a": a, "b": b, "points": [[x1, y1], [x2, y2]]},
    }


# --- Coefficient directeur d'une droite -------------------------------------------------------


def _slope(difficulty: int, rng: random.Random) -> dict:
    xa, ya = rng.randint(-6, 6), rng.randint(-6, 6)
    dx = _nonzero(rng, -6, 6)
    if difficulty <= 2:
        m = Fraction(_nonzero(rng, -4, 4))
        dy = int(m * dx)
    else:
        dy = _nonzero(rng, -9, 9)
        m = Fraction(dy, dx)
    xb, yb = xa + dx, ya + dy
    return _numeric(
        minus(
            f"Dans un repère, A({xa} ; {ya}) et B({xb} ; {yb}). Quel est le coefficient directeur de la droite (AB) ?"
        )
        + (" (fraction acceptée)" if difficulty > 2 else ""),
        frac_text(m),
        "m = (yB − yA) ÷ (xB − xA).",
        f"m = ({yb} − {p(ya)}) ÷ ({xb} − {p(xa)}) = {dy} ÷ {p(dx)} = {frac_text(m)}",
        30000 + 7000 * difficulty,
        {"a": [xa, ya], "b": [xb, yb], "m": str(m)},
        kind="fraction",
    )


# --- Équation produit nul ------------------------------------------------------------------------


def _solution_set(values) -> str:
    vals = sorted(set(values))
    return minus("{ " + " ; ".join(frac_text(v) for v in vals) + " }")


def _zero_product(difficulty: int, rng: random.Random) -> dict:
    a1 = 1 if difficulty <= 2 else _nonzero(rng, -4, 4)
    a2 = 1 if difficulty <= 3 else _nonzero(rng, -3, 3)
    r1, r2 = _nonzero(rng, -7, 7), rng.randint(-7, 7)
    while r2 == r1:
        r2 = rng.randint(-7, 7)
    # facteur = a·x + b avec racine r : b = −a·r (racines entières jusqu'au niveau 4)
    if difficulty == 5:
        r2 = Fraction(_nonzero(rng, -9, 9), rng.choice([2, 3]))
        while r2.denominator == 1:  # solution non entière
            r2 = Fraction(_nonzero(rng, -9, 9), rng.choice([2, 3]))
    f1 = poly_text({k: v for k, v in {1: a1, 0: -a1 * r1}.items() if v != 0})
    b2 = -a2 * r2
    if difficulty == 5:
        num, den = r2.numerator, r2.denominator
        a2, b2 = den * (1 if a2 > 0 else -1), -num * (1 if a2 > 0 else -1)
    f2 = poly_text({k: v for k, v in {1: a2, 0: b2}.items() if v != 0})
    roots = [Fraction(r1), Fraction(-b2, a2)]
    correct = _solution_set(roots)
    distractors = [
        _solution_set([-r for r in roots]),  # erreur de signe
        _solution_set([Fraction(-a1 * r1), Fraction(b2)]),  # « on lit le nombre »
        _solution_set([roots[0]]),
    ]
    return _mcq(
        "Quel est l'ensemble des solutions de l'équation ?",
        correct,
        distractors,
        "Un produit est nul si et seulement si l'un de ses facteurs est nul : résous chaque facteur = 0.",
        f"{_pretty(f1)} = 0 donne x = {frac_text(roots[0])} ; {_pretty(f2)} = 0 donne x = {frac_text(roots[1])} ; S = {correct}",
        30000 + 8000 * difficulty,
        rng,
        {"roots": [str(r) for r in roots]},
        latex=f"\\left({f1}\\right)\\left({f2}\\right) = 0",
    )


# --- Moyenne pondérée ---------------------------------------------------------------------------


def _weighted_mean(difficulty: int, rng: random.Random) -> dict:
    n = 2 if difficulty <= 2 else (3 if difficulty <= 4 else 4)
    while True:
        notes = [rng.randint(6, 20) for _ in range(n)]
        weights = [1 if difficulty == 1 else rng.randint(1, 4) for _ in range(n)]
        total = sum(w * x for w, x in zip(weights, notes, strict=True))
        mean = Fraction(total, sum(weights))
        if mean.denominator in (1, 2, 4, 5, 10, 20):  # moyenne décimale exacte
            break
    rows = ", ".join(f"{x} (coefficient {w})" for x, w in zip(notes, weights, strict=True))
    detail = " + ".join(f"{w} × {x}" for w, x in zip(weights, notes, strict=True))
    return _numeric(
        f"Tom a obtenu ces notes : {rows}. Quelle est sa moyenne ?",
        fr_number(mean, 2),
        "Moyenne pondérée = somme des (coefficient × note) ÷ somme des coefficients.",
        f"({detail}) ÷ {sum(weights)} = {total} ÷ {sum(weights)} = {fr_number(mean, 2)}",
        30000 + 8000 * difficulty,
        {"notes": notes, "weights": weights, "mean": str(mean)},
    )


# --- Probabilités conditionnelles ------------------------------------------------------------------


def _conditional(difficulty: int, rng: random.Random) -> dict:
    if difficulty <= 3:  # tableau croisé
        a, b, c, d = (rng.randint(5, 40) for _ in range(4))
        # lignes : externes / demi-pensionnaires ; colonnes : filles / garçons
        total = a + b + c + d
        table = (
            f"Dans un lycée : {a} filles et {b} garçons sont externes ; "
            f"{c} filles et {d} garçons sont demi-pensionnaires."
        )
        if difficulty == 1:
            q = "Quelle est la probabilité qu'un élève choisi au hasard soit une fille ?"
            num, den = a + c, total
            explain = f"{a} + {c} = {a + c} filles sur {total} élèves"
        elif difficulty == 2:
            q = "On choisit une fille au hasard. Quelle est la probabilité qu'elle soit externe ?"
            num, den = a, a + c
            explain = f"Parmi les {a + c} filles, {a} sont externes : P_F(E) = {a}/{a + c}"
        else:
            q = "On choisit un élève externe au hasard. Quelle est la probabilité que ce soit un garçon ?"
            num, den = b, a + b
            explain = f"Parmi les {a + b} externes, {b} sont des garçons : P_E(G) = {b}/{a + b}"
        return _numeric(
            f"{table} {q} (fraction)",
            frac_text(Fraction(num, den)),
            "Une probabilité conditionnelle se calcule dans la seule population sachant laquelle on se place.",
            explain,
            40000 + 8000 * difficulty,
            {"num": num, "den": den, "table": [a, b, c, d]},
            kind="fraction",
        )
    # Arbre pondéré : P(A ∩ B) = P(A) × P_A(B) ; niveau 5 : probabilités totales.
    pa = Fraction(rng.randint(2, 8), 10)
    pba = Fraction(rng.randint(1, 9), 10)
    pbna = Fraction(rng.randint(1, 9), 10)
    if difficulty == 4:
        value = pa * pba
        q = "Calcule P(A ∩ B)."
        explain = (
            f"P(A ∩ B) = P(A) × P_A(B) = {fr_number(pa)} × {fr_number(pba)} = {fr_number(value)}"
        )
    else:
        value = pa * pba + (1 - pa) * pbna
        q = "Calcule P(B)."
        explain = (
            f"Formule des probabilités totales : P(B) = {fr_number(pa)} × {fr_number(pba)} + "
            f"{fr_number(1 - pa)} × {fr_number(pbna)} = {fr_number(value)}"
        )
    return _numeric(
        f"Dans un arbre pondéré : P(A) = {fr_number(pa)}, P_A(B) = {fr_number(pba)} et P_Ā(B) = {fr_number(pbna)}. {q} "
        "(nombre décimal)",
        fr_number(value),
        "On multiplie les probabilités le long d'un chemin, on additionne les chemins qui mènent à B.",
        explain,
        45000 + 8000 * difficulty,
        {"pa": str(pa), "pba": str(pba), "pbna": str(pbna), "value": str(value)},
    )


# --- Pythagore et Thalès (automatisme) -----------------------------------------------------------

_TRIPLES = [(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 16, 20), (7, 24, 25)]


def _pythagoras(difficulty: int, rng: random.Random) -> dict:
    a, b, c = rng.choice(_TRIPLES[:3] if difficulty <= 2 else _TRIPLES)
    if difficulty in (1, 3):  # hypoténuse
        return _numeric(
            f"ABC est rectangle en A, avec AB = {a} cm et AC = {b} cm. Combien mesure BC (en cm) ?",
            str(c),
            "Pythagore : BC² = AB² + AC² (BC est l'hypoténuse, face à l'angle droit).",
            f"BC² = {a}² + {b}² = {a * a} + {b * b} = {c * c}, donc BC = √{c * c} = {c} cm",
            25000 + 8000 * difficulty,
            {"a": a, "b": b, "c": c},
        )
    if difficulty in (2, 4):  # côté de l'angle droit
        return _numeric(
            f"ABC est rectangle en A, avec BC = {c} cm et AB = {a} cm. Combien mesure AC (en cm) ?",
            str(b),
            "Pythagore : BC² = AB² + AC², donc AC² = BC² − AB².",
            f"AC² = {c}² − {a}² = {c * c} − {a * a} = {b * b}, donc AC = {b} cm",
            30000 + 8000 * difficulty,
            {"a": a, "b": b, "c": c},
        )
    # Niveau 5 : Thalès (droites parallèles), rapport entier ou demi.
    k = Fraction(rng.choice([2, 3, 4, 5]), rng.choice([1, 2]))
    am = rng.randint(2, 8) * 2
    an = rng.randint(2, 8) * 2
    ab = am * k
    ac = an * k
    return _numeric(
        f"Dans le triangle ABC, M ∈ [AB] et N ∈ [AC], avec (MN) // (BC). "
        f"AM = {am} cm, AB = {fr_number(ab)} cm et AN = {an} cm. Combien mesure AC (en cm) ?",
        fr_number(ac),
        "Thalès : AM/AB = AN/AC. Utilise le produit en croix.",
        f"AM/AB = AN/AC donc AC = AN × AB ÷ AM = {an} × {fr_number(ab)} ÷ {am} = {fr_number(ac)} cm",
        60000,
        {"am": am, "ab": str(ab), "an": an, "ac": str(ac)},
    )


# --- Lecture de code Python ------------------------------------------------------------------------


def _python(difficulty: int, rng: random.Random) -> dict:
    """« Que vaut x à la fin ? » : variables, conditions, boucles (lecture seule, avant
    le grimoire Python de la V2)."""
    a, b = rng.randint(2, 9), rng.randint(2, 9)
    if difficulty == 1:
        code = [f"x = {a}", f"x = x + {b}", "x = 2 * x"]
        x = 2 * (a + b)
    elif difficulty == 2:
        code = [f"x = {a}", f"y = {b}", "x = x * y", "y = x - y"]
        x = a * b - b
        code.append("x = y")
    elif difficulty == 3:
        limit = rng.randint(3, 9)
        code = [f"x = {a}", f"if x > {limit}:", "    x = x - 3", "else:", "    x = x * 2"]
        x = a - 3 if a > limit else a * 2
    elif difficulty == 4:
        n = rng.randint(3, 6)
        code = ["x = 0", f"for i in range({n}):", f"    x = x + {b}"]
        x = n * b
    else:
        n = rng.randint(3, 5)
        code = ["x = 1", f"for i in range({n}):", "    x = x * 2", f"x = x - {a}"]
        x = 2**n - a
    listing = "\n".join(code)
    return _numeric(
        f"Que vaut x à la fin de ce programme Python ?\n\n{listing}",
        str(x),
        "Exécute le programme ligne par ligne, en notant la valeur de chaque variable. range(n) répète n fois.",
        f"En suivant les lignes une à une, x vaut {x} à la fin",
        30000 + 10000 * difficulty,
        {"code": code, "x": x},
    )


def _gen(code, notion, role, title, fn) -> Generator:
    return register(
        Generator(code=code, level="2nde", notion=notion, role=role, title=title, generate=fn)
    )


IMAGE = _gen(
    "2nde.fonctions.image",
    "2nde.maths.fonctions.image_antecedent",
    "chapitre",
    "Image d'un nombre",
    _image,
)
AFFINE = _gen(
    "2nde.fonctions.affine", "2nde.maths.fonctions.affine", "chapitre", "Fonction affine", _affine
)
SLOPE = _gen(
    "2nde.droites.coefficient",
    "2nde.maths.geometrie_reperee.droites",
    "chapitre",
    "Coefficient directeur",
    _slope,
)
ZERO_PRODUCT = _gen(
    "2nde.equations.produit_nul",
    "2nde.maths.equations.produit_nul",
    "chapitre",
    "Équation produit nul",
    _zero_product,
)
WEIGHTED_MEAN = _gen(
    "2nde.statistiques.moyenne",
    "2nde.maths.statistiques.indicateurs",
    "chapitre",
    "Moyenne pondérée",
    _weighted_mean,
)
CONDITIONAL = _gen(
    "2nde.probabilites.conditionnelles",
    "2nde.maths.probabilites.conditionnelles",
    "chapitre",
    "Probabilités conditionnelles",
    _conditional,
)
PYTHAGORAS = _gen(
    "2nde.automatismes.pythagore",
    "2nde.maths.automatismes.pythagore_thales",
    "automatisme",
    "Pythagore et Thalès",
    _pythagoras,
)
PYTHON = _gen(
    "2nde.python.lecture",
    "2nde.maths.python.variables",
    "chapitre",
    "Lecture de code Python",
    _python,
)
