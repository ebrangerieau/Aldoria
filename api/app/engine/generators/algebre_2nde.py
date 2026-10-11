"""Calcul littéral et équations, seconde (arrêté du 26 février 2026) :
factoriser, équations du premier degré, inéquations du premier degré."""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.developper_2nde import _linear, _mul, _pretty, poly_text
from app.engine.generators.formatting import fr_number, frac_text, minus, sentence


def _nonzero(rng: random.Random, low: int, high: int) -> int:
    return rng.choice([v for v in range(low, high + 1) if v != 0])


def _signed(v: int) -> str:
    return f"+ {v}" if v >= 0 else f"− {-v}"


# --- Factoriser ----------------------------------------------------------------------


def _factorise(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # k·x + k·a = k(x + a)
        k, a = rng.randint(2, 9), _nonzero(rng, -9, 9)
        factored = f"{k}({poly_text(_linear(1, a))})"
        expanded = _mul({0: k}, _linear(1, a))
        hint = f"Les deux termes sont des multiples de {k}."
        detail = f"{k} est un facteur commun"
    elif difficulty == 2:  # a·x² + b·x = x(a·x + b)
        a, b = rng.randint(1, 6), _nonzero(rng, -9, 9)
        factored = f"x({poly_text(_linear(a, b))})"
        expanded = _mul({1: 1}, _linear(a, b))
        hint = "x apparaît dans chaque terme : c'est un facteur commun."
        detail = "x est un facteur commun"
    elif difficulty == 3:  # x² − a² = (x − a)(x + a)
        a = rng.randint(1, 10)
        factored = f"({poly_text(_linear(1, -a))})({poly_text(_linear(1, a))})"
        expanded = _mul(_linear(1, -a), _linear(1, a))
        hint = "Identité remarquable : a² − b² = (a − b)(a + b)."
        detail = f"on reconnaît a² − b² avec a = x et b = {a}"
    elif difficulty == 4:  # x² ± 2ax + a² = (x ± a)²
        a = _nonzero(rng, -9, 9)
        factored = f"({poly_text(_linear(1, a))})^2"
        expanded = _mul(_linear(1, a), _linear(1, a))
        hint = "Identité remarquable : a² + 2ab + b² = (a + b)²."
        detail = f"on reconnaît le carré de x {'+' if a > 0 else '−'} {abs(a)}"
    else:  # (ax+b)(cx+d) + (ax+b)(ex+f) = (ax+b)((c+e)x + (d+f))
        a, b = rng.randint(1, 4), _nonzero(rng, -6, 6)
        c, d = rng.randint(1, 4), _nonzero(rng, -6, 6)
        e, f = rng.randint(1, 4), _nonzero(rng, -6, 6)
        while d + f == 0:
            f = _nonzero(rng, -6, 6)
        common = poly_text(_linear(a, b))
        shown = f"({common})({poly_text(_linear(c, d))}) + ({common})({poly_text(_linear(e, f))})"
        factored = f"({common})({poly_text(_linear(c + e, d + f))})"
        expanded = _mul(_linear(a, b), _linear(c + e, d + f))
        hint = f"Repère le facteur commun ({common})."
        detail = f"({common}) est un facteur commun"
        return _expression_item(
            shown, factored, expanded, hint, detail, difficulty, show_expanded=False
        )
    return _expression_item(poly_text(expanded), factored, expanded, hint, detail, difficulty)


def _expression_item(shown, factored, expanded, hint, detail, difficulty, show_expanded=True):
    latex = (
        (poly_text(expanded, latex=True) if show_expanded else shown)
        .replace("(", "\\left(")
        .replace(")", "\\right)")
    )
    return {
        "type": "expression",
        "prompt": "Factorise l'expression.",
        "latex": latex,
        "answer": {"kind": "expression", "value": factored, "variable": "x", "form": "factored"},
        "hint": hint,
        "explanation": _pretty(f"{detail[0].upper()}{detail[1:]} : {shown} = {factored}."),
        "time_target_ms": 30000 + 12000 * difficulty,  # 42 s à 90 s
        "meta": {"expression": shown, "factored": factored},
    }


# --- Équations du premier degré -------------------------------------------------------


def _equation(difficulty: int, rng: random.Random) -> dict:
    """a·x + b = c·x + e, solution x = (e − b) / (a − c)."""
    c = 0
    if difficulty == 1:  # x + b = e
        a, b = 1, _nonzero(rng, -12, 12)
        e = _nonzero(rng, -9, 9) + b
    elif difficulty == 2:  # a·x = e
        a, b = rng.choice([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]), 0
        e = a * _nonzero(rng, -9, 9)
    elif difficulty == 3:  # a·x + b = e
        a, b = _nonzero(rng, -9, 9), _nonzero(rng, -15, 15)
        e = a * _nonzero(rng, -9, 9) + b
    else:  # a·x + b = c·x + e
        a, c = _nonzero(rng, -9, 9), _nonzero(rng, -9, 9)
        # Au niveau 5, |a − c| ≥ 2 : sinon toute solution serait entière (boucle sans fin).
        while a == c or (difficulty == 5 and abs(a - c) < 2):
            c = _nonzero(rng, -9, 9)
        b = _nonzero(rng, -15, 15)
        if difficulty == 4:
            e = (a - c) * _nonzero(rng, -9, 9) + b
        else:  # solution rationnelle non entière
            e = _nonzero(rng, -20, 20)
            while (e - b) % (a - c) == 0:
                e = _nonzero(rng, -20, 20)
    x = Fraction(e - b, a - c)
    left = poly_text({k: v for k, v in {1: a, 0: b}.items() if v != 0})
    right = poly_text({k: v for k, v in {1: c, 0: e}.items() if v != 0})

    steps = []
    if c:
        steps.append(
            f"on regroupe les x d'un côté et les nombres de l'autre : {poly_text({1: a - c})} = {e - b}"
        )
    elif b:
        verb = f"on enlève {b}" if b > 0 else f"on ajoute {-b}"
        steps.append(f"{verb} des deux côtés : {poly_text({1: a})} = {e - b}")
    if a - c != 1:
        steps.append(f"on divise par {a - c} : x = {frac_text(x)}")
    elif not steps:
        steps.append(f"x = {frac_text(x)}")
    return {
        "type": "numeric",
        "prompt": "Résous l'équation : donne la valeur de x.",
        "latex": f"{left} = {right}",
        "answer": {"kind": "fraction", "value": frac_text(x), "accept_equivalent": True},
        "hint": "Isole x : regroupe les termes en x d'un côté et les nombres de l'autre.",
        "explanation": minus(sentence(", ".join(steps))),
        "time_target_ms": 25000 + 10000 * difficulty,  # 35 s à 75 s
        "meta": {"a": a, "b": b, "c": c, "e": e},
    }


# --- Inéquations du premier degré ------------------------------------------------------


def _interval(bound: Fraction, direction: str, strict: bool) -> str:
    """direction « < » ou « > » : solutions inférieures ou supérieures à bound."""
    b = (
        fr_number(bound, 2)
        if bound.denominator in (1, 2, 4, 5)
        else frac_text(bound).replace("-", "−")
    )
    if direction == "<":
        return f"]−∞ ; {b}{'[' if strict else ']'}"
    return f"{']' if strict else '['}{b} ; +∞["


def _inequation(difficulty: int, rng: random.Random) -> dict:
    a = rng.randint(2, 9) if difficulty == 1 else _nonzero(rng, -9, 9)
    if difficulty == 2:
        a = -rng.randint(2, 9)  # piège du changement de sens
    if a in (1, -1) and difficulty > 1:
        a *= rng.randint(2, 5)
    b = _nonzero(rng, -12, 12)
    sign = rng.choice(["<", "≤", ">", "≥"])
    if difficulty <= 4:
        bound = Fraction(_nonzero(rng, -8, 8))
        c = a * bound + b
        latex_left = poly_text({1: a, 0: b})
        latex = f"{latex_left} {_latex_sign(sign)} {c}"
    else:
        bound = Fraction(_nonzero(rng, -9, 9), rng.choice([2, 4, 5]))
        c = a * bound + b
        latex = f"{poly_text({1: a, 0: b})} {_latex_sign(sign)} {frac_text(c)}"
    strict = sign in "<>"
    keeps = (sign in "<≤") == (a > 0)
    direction = "<" if keeps else ">"
    correct = _interval(bound, direction, strict)
    distractors = [
        _interval(bound, ">" if direction == "<" else "<", strict),  # oubli du changement de sens
        _interval(bound, direction, not strict),  # crochet du mauvais côté
        _interval(-bound, direction, strict),  # erreur de signe
        _interval(bound + 1, direction, strict),
    ]
    choices = [correct]
    for d in distractors:
        if d not in choices:
            choices.append(d)
    choices = choices[:4]
    rng.shuffle(choices)
    flip = a < 0
    verb = f"On enlève {b}" if b > 0 else f"On ajoute {-b}"
    explanation = (
        f"{verb} des deux côtés : {poly_text({1: a})} {sign} {frac_text(c - b)}. "
        f"On divise par {a}{', un nombre négatif : on change le sens de l’inégalité' if flip else ''} : "
        f"x {_flip(sign) if flip else sign} {frac_text(bound)}, soit S = {correct}."
    )
    return {
        "type": "mcq",
        "prompt": "Quel est l'ensemble des solutions de l'inéquation ?",
        "latex": latex,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(correct)},
        "hint": "Isole x. Attention : diviser par un nombre négatif change le sens de l'inégalité.",
        "explanation": minus(explanation),
        "time_target_ms": 25000 + 8000 * difficulty,  # 33 s à 65 s
        "meta": {"a": a, "b": b, "c": str(c), "sign": sign, "bound": str(bound)},
    }


def _latex_sign(sign: str) -> str:
    return {"<": "<", ">": ">", "≤": "\\leq", "≥": "\\geq"}[sign]


def _flip(sign: str) -> str:
    return {"<": ">", ">": "<", "≤": "≥", "≥": "≤"}[sign]


FACTORISER = register(
    Generator(
        code="2nde.calcul.factoriser",
        level="2nde",
        notion="2nde.maths.calcul_litteral.factorisation",
        role="chapitre",
        title="Factoriser",
        generate=_factorise,
    )
)

EQUATIONS = register(
    Generator(
        code="2nde.equations.premier_degre",
        level="2nde",
        notion="2nde.maths.equations.premier_degre",
        role="chapitre",
        title="Équations du premier degré",
        generate=_equation,
    )
)

INEQUATIONS = register(
    Generator(
        code="2nde.equations.inequations",
        level="2nde",
        notion="2nde.maths.equations.inequations",
        role="chapitre",
        title="Inéquations du premier degré",
        generate=_inequation,
    )
)
