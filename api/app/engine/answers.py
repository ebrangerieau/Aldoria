"""Validation des réponses (TRD §2.4 et §5.4).

Le client valide localement pour un retour instantané (game/core/math/answer_checker.gd) ;
cette implémentation sert de référence et doit rendre le même verdict sur
content/test-vectors/answers.json.

Types de réponse attendue (`answer.kind`) :
- `choice`     : {"index": 2}
- `number`     : {"value": "2.5", "tolerance": 0.001}  (accepte aussi « 5/2 »)
- `fraction`   : {"value": "11/12", "accept_equivalent": true, "require_irreducible": false}
- `expression` : {"value": "x^2+6x+9", "variable": "x", "form": "expanded" | null}
"""

from __future__ import annotations

import re
from fractions import Fraction
from typing import Any

from app.engine import mathexpr

_RATIONAL = re.compile(r"^([+-]?)(\d+(?:[.,]\d+)?)(?:/(\d+))?$")


def parse_rational(text: str) -> tuple[Fraction, int | None, int | None] | None:
    """« -3/4 », « 0,75 », « 2 » → (valeur exacte, numérateur saisi, dénominateur saisi).

    Numérateur et dénominateur saisis ne sont renseignés que pour une fraction écrite
    a/b (utile pour vérifier qu'elle est irréductible). Renvoie None si illisible.
    """
    s = mathexpr.normalize(text)
    match = _RATIONAL.match(s)
    if not match:
        return None
    sign, num_text, den_text = match.groups()
    num = Fraction(num_text.replace(",", "."))
    if den_text is not None:
        if "." in num_text or "," in num_text:
            return None
        den = int(den_text)
        if den == 0:
            return None
        value = num / den
        numerator, denominator = int(num_text), den
    else:
        value = num
        numerator = denominator = None
    if sign == "-":
        value = -value
        numerator = -numerator if numerator is not None else None
    return value, numerator, denominator


def check(answer: dict[str, Any], user_input: Any) -> bool:
    kind = answer["kind"]
    if kind == "choice":
        try:
            return int(user_input) == int(answer["index"])
        except (TypeError, ValueError):
            return False
    if kind == "number":
        parsed = parse_rational(str(user_input))
        expected = parse_rational(str(answer["value"]))
        if parsed is None or expected is None:
            return False
        tolerance = Fraction(str(answer.get("tolerance", 0)))
        return abs(parsed[0] - expected[0]) <= tolerance
    if kind == "fraction":
        return _check_fraction(answer, str(user_input))
    if kind == "expression":
        return _check_expression(answer, str(user_input))
    raise ValueError(f"type de réponse inconnu : {kind}")


def _check_fraction(answer: dict[str, Any], text: str) -> bool:
    parsed = parse_rational(text)
    expected = parse_rational(str(answer["value"]))
    if parsed is None or expected is None:
        return False
    value, numerator, denominator = parsed
    if value != expected[0]:
        return False
    if answer.get("require_irreducible") and denominator is not None:
        from math import gcd

        if gcd(abs(numerator), denominator) != 1:
            return False
    if not answer.get("accept_equivalent", True):
        # Forme exacte imposée : même numérateur et dénominateur que la réponse attendue.
        return (numerator, denominator) == (expected[1], expected[2])
    return True


def _check_expression(answer: dict[str, Any], text: str) -> bool:
    variable = answer.get("variable", "x")
    try:
        if not mathexpr.equivalent(text, str(answer["value"]), variable):
            return False
    except mathexpr.ExprError:
        return False
    form = answer.get("form")
    if form == "expanded":
        # Forme développée : plus aucune parenthèse.
        return "(" not in mathexpr.normalize(text)
    if form == "factored":
        return "(" in mathexpr.normalize(text)
    return True
