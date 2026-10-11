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


def test_registry_has_all_generators():
    assert set(REGISTRY) >= {
        "6e.fractions.addition",
        "6e.fractions.comparaison",
        "6e.fractions.produit_entier",
        "6e.fractions.egalite",
        "6e.prealgebre.balance",
        "2nde.automatismes.evolutions",
        "2nde.calcul.developper",
        "2nde.calcul.factoriser",
        "2nde.equations.premier_degre",
        "2nde.equations.inequations",
        "2nde.vecteurs.coordonnees",
        "2nde.vecteurs.colinearite",
        "2nde.geometrie.milieu_distance",
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


# --- Phase 2 -----------------------------------------------------------------------------


def _parse_pair(text: str) -> tuple:
    x, y = text.strip("()").split(" ; ")
    return sympy.nsimplify(_fr_to_float(x)), sympy.nsimplify(_fr_to_float(y))


def test_fraction_product():
    for item in _items("6e.fractions.produit_entier"):
        m = item.meta
        expected = m["k"] * sympy.Rational(m["n"], m["d"])
        assert sympy.Rational(item.answer.value) == expected, item.id
        assert answers.check(item.answer.model_dump(), item.answer.value)


def test_fraction_equality():
    for item in _items("6e.fractions.egalite"):
        m = item.meta
        if item.answer.kind == "number":
            value = int(item.answer.value)
            assert value in (m["n"] * m["k"], m["d"] * m["k"]), item.id
        else:
            assert sympy.Rational(item.answer.value) == sympy.Rational(m["n"], m["d"])
            # La fraction non simplifiée de l'énoncé est refusée.
            assert not answers.check(
                item.answer.model_dump(), f"{m['n'] * m['k']}/{m['d'] * m['k']}"
            )
            assert answers.check(item.answer.model_dump(), item.answer.value)


def test_balance():
    for item in _items("6e.prealgebre.balance"):
        m = item.meta
        x = int(item.answer.value)
        # Vérification par substitution : la balance est bien équilibrée pour cette valeur.
        assert m["left_boxes"] * x + m["left_units"] == m["right_boxes"] * x + m["right_units"]
        assert m["left_boxes"] != m["right_boxes"] and m["right_units"] > 0, item.id


def test_factorise():
    for item in _items("2nde.calcul.factoriser"):
        expanded = sympy.expand(_sym(item.meta["expression"]))
        assert sympy.expand(_sym(item.answer.value)) == expanded, item.id
        assert answers.check(item.answer.model_dump(), item.answer.value), item.id
        # Recopier l'énoncé développé n'est pas une factorisation.
        assert not answers.check(item.answer.model_dump(), str(expanded).replace("**", "^")), (
            item.id
        )


def test_equations():
    for item in _items("2nde.equations.premier_degre"):
        m = item.meta
        x = Fraction(item.answer.value)
        # Substitution exacte : la valeur annoncée vérifie l'équation, et c'est la seule.
        assert m["a"] * x + m["b"] == m["c"] * x + m["e"], item.id
        assert m["a"] != m["c"]
        if item.difficulty == 5:
            assert x.denominator != 1, "solution non entière au niveau 5"


def test_inequations():
    holds = {
        "<": lambda lhs, rhs: lhs < rhs,
        "≤": lambda lhs, rhs: lhs <= rhs,
        ">": lambda lhs, rhs: lhs > rhs,
        "≥": lambda lhs, rhs: lhs >= rhs,
    }
    for item in _items("2nde.equations.inequations"):
        m = item.meta
        a, b, c, bound = m["a"], m["b"], Fraction(m["c"]), Fraction(m["bound"])
        relation = holds[m["sign"]]
        assert a * bound + b == c, item.id  # la borne annule bien l'inégalité
        chosen = item.choices[item.answer.index]
        # Crochet fermé si et seulement si la borne est solution.
        assert (chosen.startswith("[") or chosen.endswith("]")) == relation(a * bound + b, c), (
            item.id
        )
        # Bon côté : un point très à gauche est solution ssi l'intervalle part de −∞.
        far_left = bound - 1000
        assert ("−∞" in chosen) == relation(a * far_left + b, c), item.id
        assert len(item.choices) == len(set(item.choices)) >= 3


def test_vector_coordinates():
    for item in _items("2nde.vecteurs.coordonnees"):
        assert _parse_pair(item.choices[item.answer.index]) == tuple(item.meta["result"]), item.id


def test_collinearity():
    for item in _items("2nde.vecteurs.colinearite"):
        u = sympy.Matrix(item.meta["u"])
        v = sympy.Matrix([sympy.Rational(c) for c in item.meta["v"]])
        det = sympy.Matrix.hstack(u, v).det()
        if item.type == "numeric":
            assert int(item.answer.value) == det, item.id
        else:
            assert item.choices[item.answer.index] == ("Oui" if det == 0 else "Non"), item.id


def test_midpoint_distance():
    for item in _items("2nde.geometrie.milieu_distance"):
        (xa, ya), (xb, yb) = item.meta["a"], item.meta["b"]
        if item.meta["case"] == "milieu":
            expected = (sympy.Rational(xa + xb, 2), sympy.Rational(ya + yb, 2))
            assert _parse_pair(item.choices[item.answer.index]) == expected, item.id
        else:
            d = int(item.answer.value)
            assert d * d == (xb - xa) ** 2 + (yb - ya) ** 2, item.id


@pytest.mark.parametrize("code", sorted(REGISTRY))
def test_latex_renders(code):
    from app.engine.formulas import render_svg

    for difficulty in DIFFICULTIES:
        item = REGISTRY[code].item(difficulty, 3)
        if item.latex:
            assert render_svg(item.latex).startswith("<svg"), item.id
            assert "	" not in item.latex and "" not in item.latex
