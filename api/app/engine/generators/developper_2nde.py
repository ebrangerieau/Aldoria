"""Calcul littéral, seconde : développer (distributivité, identités remarquables).

Réponse de type `expression`, forme développée exigée (sans parenthèses).
"""

from __future__ import annotations

import random
import re

from app.engine.generators import Generator, register

Poly = dict[int, int]  # puissance de x → coefficient


def _mul(p: Poly, q: Poly) -> Poly:
    out: Poly = {}
    for i, a in p.items():
        for j, b in q.items():
            out[i + j] = out.get(i + j, 0) + a * b
    return {k: v for k, v in out.items() if v != 0}


def _linear(a: int, b: int) -> Poly:
    return {k: v for k, v in {1: a, 0: b}.items() if v != 0}


def poly_text(p: Poly, latex: bool = False) -> str:
    """{2: 1, 1: 6, 0: 9} → « x^2+6x+9 » (ou « x^{2}+6x+9 » en LaTeX)."""
    if not p:
        return "0"
    parts = []
    for power in sorted(p, reverse=True):
        coeff = p[power]
        sign = "-" if coeff < 0 else "+"
        mag = abs(coeff)
        if power == 0:
            body = str(mag)
        else:
            var = "x" if power == 1 else (f"x^{{{power}}}" if latex else f"x^{power}")
            body = var if mag == 1 else f"{mag}{var}"
        parts.append((sign, body))
    first_sign, first_body = parts[0]
    text = ("-" if first_sign == "-" else "") + first_body
    for sign, body in parts[1:]:
        text += f"{sign}{body}"
    return text


def _factor(a: int, b: int) -> str:
    """ax+b entre parenthèses, en texte simple (sert aussi au LaTeX)."""
    return f"({poly_text(_linear(a, b))})"


def _nonzero(rng: random.Random, low: int, high: int) -> int:
    return rng.choice([v for v in range(low, high + 1) if v != 0])


_BINARY_OP = re.compile(r"(?<=[\w²)])\s*([+-])\s*(?=[\w(])")


def _pretty(text: str) -> str:
    """Texte affiché à l'élève : exposants, signe moins typographique, opérateurs espacés."""
    text = text.replace("^2", "²").replace("(-", "(−")
    return _BINARY_OP.sub(lambda m: " + " if m.group(1) == "+" else " − ", text)


def _develop(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # k(ax+b)
        k = rng.choice([-5, -4, -3, -2, 2, 3, 4, 5, 6])
        a, b = rng.randint(1, 4), _nonzero(rng, -9, 9)
        result = _mul({0: k}, _linear(a, b))
        shown = f"{k}{_factor(a, b)}"
        hint = "Distribue le facteur devant la parenthèse à chaque terme : k(a + b) = ka + kb."
        detail = f"{k} × {poly_text(_linear(a, 0))} + {k} × ({b})"
    elif difficulty == 2:  # (x+a)(x+b)
        a, b = _nonzero(rng, -9, 9), _nonzero(rng, -9, 9)
        result = _mul(_linear(1, a), _linear(1, b))
        shown = f"{_factor(1, a)}{_factor(1, b)}"
        hint = "Double distributivité : chaque terme de la 1re parenthèse multiplie chaque terme de la 2e."
        detail = f"x × x + x × ({b}) + ({a}) × x + ({a}) × ({b})"
    elif difficulty == 3:  # (x±a)²
        a = _nonzero(rng, -9, 9)
        result = _mul(_linear(1, a), _linear(1, a))
        shown = f"{_factor(1, a)}^2"
        identity = "(a + b)² = a² + 2ab + b²" if a > 0 else "(a − b)² = a² − 2ab + b²"
        hint = f"Identité remarquable : {identity}."
        detail = f"x² {'+' if a > 0 else '−'} 2 × x × {abs(a)} + {abs(a)}²"
    elif difficulty == 4:  # (ax+b)² ou (ax+b)(ax−b)
        a, b = rng.randint(2, 5), rng.randint(1, 9)
        if rng.random() < 0.5:
            b = b if rng.random() < 0.5 else -b
            result = _mul(_linear(a, b), _linear(a, b))
            shown = f"{_factor(a, b)}^2"
            hint = "Identité remarquable : (a + b)² = a² + 2ab + b² (attention au carré de ax)."
            detail = f"({a}x)² {'+' if b > 0 else '−'} 2 × {a}x × {abs(b)} + {abs(b)}²"
        else:
            result = _mul(_linear(a, b), _linear(a, -b))
            shown = f"{_factor(a, b)}{_factor(a, -b)}"
            hint = "Identité remarquable : (a + b)(a − b) = a² − b²."
            detail = f"({a}x)² − {b}²"
    else:  # (ax+b)(cx+d) avec signes variés
        a, c = _nonzero(rng, -4, 5), _nonzero(rng, -4, 5)
        b, d = _nonzero(rng, -7, 7), _nonzero(rng, -7, 7)
        result = _mul(_linear(a, b), _linear(c, d))
        shown = f"{_factor(a, b)}{_factor(c, d)}"
        hint = "Double distributivité, puis regroupe les termes en x. Attention aux signes."
        detail = f"{a}x × {c}x + {a}x × ({d}) + ({b}) × {c}x + ({b}) × ({d})"

    answer = poly_text(result)
    latex = shown.replace("(", "\\left(").replace(")", "\\right)")
    return {
        "type": "expression",
        "prompt": "Développe et réduis l'expression.",
        "latex": latex,
        "answer": {"kind": "expression", "value": answer, "variable": "x", "form": "expanded"},
        "hint": hint,
        "explanation": _pretty(f"{shown} = {detail} = {answer}."),
        "time_target_ms": 20000 + 10000 * difficulty,
        "meta": {"expression": shown},
    }


DEVELOPPER = register(
    Generator(
        code="2nde.calcul.developper",
        level="2nde",
        notion="2nde.maths.calcul_litteral.developpement",
        role="chapitre",
        title="Développer et réduire",
        generate=_develop,
    )
)
