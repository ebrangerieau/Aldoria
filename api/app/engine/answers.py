"""Validation des réponses (TRD §2.4 et §5.4).

Le client valide localement pour un retour instantané (game/core/math/answer_checker.gd) ;
cette implémentation sert de référence et doit rendre le même verdict sur
content/test-vectors/answers.json.

Types de réponse attendue (`answer.kind`) :
- `choice`     : {"index": 2}
- `number`     : {"value": "2.5", "tolerance": 0.001}  (accepte aussi « 5/2 »)
- `fraction`   : {"value": "11/12", "accept_equivalent": true, "require_irreducible": false}
- `expression` : {"value": "x^2+6x+9", "variable": "x", "form": "expanded" | null}
- `vector`     : {"value": ["3", "-2"]}  (saisie : liste de 2 nombres)
- `order`      : {"value": [2, 0, 1]}  (saisie : indices des choix dans l'ordre donné)
- `true_false` : {"value": false, "reason": 1}  (saisie : {"value": bool, "reason": indice})
- `signs`      : {"value": ["+", "-", "+"]}  (saisie : liste de « + » / « - », ou « − »)
- `text`       : {"value": ["mum", "mom"], "accents": true}  (réponses écrites acceptées ;
                 casse, espaces, apostrophe typographique et point final ignorés ; accents
                 comptés seulement si `accents`)
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
    if kind == "vector":
        return _check_vector(answer, user_input)
    if kind == "order":
        return _check_order(answer, user_input)
    if kind == "true_false":
        return _check_true_false(answer, user_input)
    if kind == "signs":
        return _check_signs(answer, user_input)
    if kind == "text":
        got = normalize_text(str(user_input), bool(answer.get("accents", True)))
        accepted = {
            normalize_text(str(v), bool(answer.get("accents", True))) for v in answer["value"]
        }
        return got != "" and got in accepted
    raise ValueError(f"type de réponse inconnu : {kind}")


# Lettres accentuées → lettre de base (même table que le client, answer_checker.gd).
_ACCENTS = {
    "à": "a", "á": "a", "â": "a", "ä": "a", "ã": "a", "å": "a", "ç": "c",
    "è": "e", "é": "e", "ê": "e", "ë": "e", "ì": "i", "í": "i", "î": "i", "ï": "i",
    "ñ": "n", "ò": "o", "ó": "o", "ô": "o", "ö": "o", "õ": "o",
    "ù": "u", "ú": "u", "û": "u", "ü": "u", "ý": "y", "ÿ": "y", "œ": "oe", "æ": "ae",
}  # fmt: skip


def normalize_text(text: str, accents: bool = True) -> str:
    """Réponse écrite comparable : minuscules, espaces réduits, apostrophe droite, sans
    point final ; sans accents si `accents` est faux."""
    s = text.replace("’", "'").replace("‘", "'").replace("\u00a0", " ").lower()
    s = " ".join(s.split()).rstrip(".!?").strip()
    if not accents:
        s = "".join(_ACCENTS.get(c, c) for c in s)
    return s


def _check_true_false(answer: dict[str, Any], user_input: Any) -> bool:
    """Le verdict ET la justification doivent être justes (un « Faux » au hasard ne suffit pas)."""
    if not isinstance(user_input, dict) or not isinstance(user_input.get("value"), bool):
        return False
    reason = user_input.get("reason")
    if isinstance(reason, bool) or not isinstance(reason, int | float) or reason != int(reason):
        return False
    return user_input["value"] is answer["value"] and int(reason) == int(answer["reason"])


def _check_signs(answer: dict[str, Any], user_input: Any) -> bool:
    if not isinstance(user_input, list | tuple) or len(user_input) != len(answer["value"]):
        return False
    got = [str(v).strip().replace("−", "-") for v in user_input]
    return got == list(answer["value"])


def _check_order(answer: dict[str, Any], user_input: Any) -> bool:
    if not isinstance(user_input, list | tuple) or len(user_input) != len(answer["value"]):
        return False
    try:
        # Le JSON du client donne des flottants (2 → 2.0) : on accepte les entiers exacts.
        got = [int(v) for v in user_input if float(v) == int(v)]
    except (TypeError, ValueError):
        return False
    return got == [int(v) for v in answer["value"]]


def _check_vector(answer: dict[str, Any], user_input: Any) -> bool:
    if not isinstance(user_input, list | tuple) or len(user_input) != 2:
        return False
    for got, expected in zip(user_input, answer["value"], strict=True):
        parsed, wanted = parse_rational(str(got)), parse_rational(str(expected))
        if parsed is None or wanted is None or parsed[0] != wanted[0]:
            return False
    return True


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
        # Un vrai produit (« 3(x+2) », « (x+3)² ») : « (x²−9) » n'est pas une factorisation.
        return "(" in mathexpr.normalize(text) and mathexpr.is_product(text)
    return True
