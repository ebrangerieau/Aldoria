"""Générateurs : 1 000 tirages par difficulté (TRD §5.2), réponses vérifiées
par un calcul indépendant (SymPy) et par le validateur de réponses."""

from fractions import Fraction

import pytest
import sympy
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from app.engine import answers
from app.engine.generators import REGISTRY

DRAWS = 1000
DIFFICULTIES = range(1, 6)
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)


def _items(code):
    gen = REGISTRY[code]
    for difficulty in DIFFICULTIES:
        for seed in range(DRAWS):
            yield gen.item(difficulty, seed)


def _sym(text: str):
    return parse_expr(text.replace("−", "-"), transformations=TRANSFORMS)


def _fr_to_float(text: str) -> float:
    return float(text.replace("−", "-").replace(",", ".").replace(" %", ""))


def test_registry_has_phase1_generators():
    assert set(REGISTRY) >= {
        "6e.fractions.addition",
        "6e.fractions.comparaison",
        "2nde.automatismes.evolutions",
        "2nde.calcul.developper",
    }


@pytest.mark.parametrize("code", sorted(REGISTRY))
def test_items_are_deterministic_and_complete(code):
    gen = REGISTRY[code]
    for difficulty in DIFFICULTIES:
        a, b = gen.item(difficulty, 42), gen.item(difficulty, 42)
        assert a == b
        assert a.explanation and a.hint and a.prompt
        assert a.time_target_ms > 0
        if a.type == "mcq":
            assert a.choices and len(a.choices) == len(set(a.choices))
            assert 0 <= a.answer.index < len(a.choices)


def test_fraction_addition():
    for item in _items("6e.fractions.addition"):
        m = item.meta
        f1, f2 = sympy.Rational(m["n1"], m["d1"]), sympy.Rational(m["n2"], m["d2"])
        expected = f1 + f2 if m["op"] == "+" else f1 - f2
        assert expected >= 0, item.id
        assert sympy.Rational(item.answer.value) == expected, item.id
        # La bonne réponse, saisie telle quelle ou non simplifiée, est acceptée.
        assert answers.check(item.answer.model_dump(), item.answer.value)
        assert answers.check(item.answer.model_dump(), f"{expected.p * 2}/{expected.q * 2}")


def test_fraction_comparison():
    for item in _items("6e.fractions.comparaison"):
        m = item.meta
        left = sympy.Rational(m["n1"], m["d1"])
        right = sympy.Rational(1) if item.difficulty == 4 else sympy.Rational(m["n2"], m["d2"])
        symbol = item.choices[item.answer.index]
        assert {"<": left < right, "=": left == right, ">": left > right}[symbol], item.id


def test_comparison_sometimes_equal():
    symbols = {
        i.choices[i.answer.index]
        for i in (REGISTRY["6e.fractions.comparaison"].item(3, s) for s in range(300))
    }
    assert symbols == {"<", "=", ">"}


def test_evolutions():
    for item in _items("2nde.automatismes.evolutions"):
        m = item.meta
        chosen = item.choices[item.answer.index]
        if m["case"] == "hausse":
            assert sympy.nsimplify(_fr_to_float(chosen)) == 1 + sympy.Rational(m["t"])
        elif m["case"] == "baisse":
            assert sympy.nsimplify(_fr_to_float(chosen)) == 1 - sympy.Rational(m["t"])
        elif m["case"] == "coefficient":
            c = sympy.Rational(m["c"])
            rate = sympy.nsimplify(_fr_to_float(chosen.split(" de ")[1])) / 100
            assert (1 + rate if "hausse" in chosen else 1 - rate) == c, item.id
        elif m["case"] == "successives":
            total = (1 + sympy.Rational(m["t1"])) * (1 - sympy.Rational(m["t2"])) - 1
            if total == 0:
                assert chosen == "aucune évolution"
            else:
                rate = sympy.nsimplify(_fr_to_float(chosen.split(" de ")[1])) / 100
                assert (rate if "hausse" in chosen else -rate) == total, item.id
        else:
            up, down = sympy.Rational(m["up"], 100), sympy.Rational(m["down"], 100)
            assert (1 + up) * (1 - down) == 1
            assert chosen == f"{m['down']} %"


def test_develop():
    for item in _items("2nde.calcul.developper"):
        expected = sympy.expand(_sym(item.meta["expression"]))
        assert sympy.expand(_sym(item.answer.value) - expected) == 0, item.id
        assert answers.check(item.answer.model_dump(), item.answer.value), item.id
        # La forme non développée de l'énoncé est refusée.
        assert not answers.check(item.answer.model_dump(), item.meta["expression"]), item.id


def test_fraction_answers_are_exact_fractions():
    for item in _items("6e.fractions.addition"):
        assert Fraction(item.answer.value) >= 0
