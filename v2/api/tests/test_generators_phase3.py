"""Phase 3 : 30 nouveaux générateurs. Chaque réponse attendue est recalculée
indépendamment à partir des valeurs tirées (meta), sur 1 000 tirages par difficulté,
puis acceptée par le validateur ; les QCM ont une seule bonne réponse."""

import re
from decimal import Decimal
from fractions import Fraction

import pytest
import sympy

from app.engine import answers
from app.engine.generators import REGISTRY, for_level
from tests.test_generators import _sym

DIFFICULTIES = range(1, 6)
DRAWS = 1000


def _items(code, draws=DRAWS):
    gen = REGISTRY[code]
    for difficulty in DIFFICULTIES:
        for seed in range(draws):
            yield gen.item(difficulty, seed)


def _value(item):
    """Réponse attendue, en nombre exact."""
    text = item.answer.value.replace("−", "-").replace(",", ".").replace(" ", "")
    return Fraction(text)


def _choice(item):
    return item.choices[item.answer.index]


def test_twenty_generators_per_level():
    """Objectif du MVP (IMPLEMENTATION_PLAN §4) : 20 générateurs de combat par niveau."""
    for level in ("6e", "2nde"):
        assert len([g for g in for_level(level) if g.combat]) >= 20, level


@pytest.mark.parametrize(
    "code",
    sorted(
        c
        for c, g in REGISTRY.items()
        if g.generate.__module__.rsplit(".", 1)[-1]
        in {"nombres_6e", "problemes_6e", "nombres_2nde", "fonctions_2nde"}
    ),
)
def test_expected_answer_is_accepted(code):
    for item in _items(code, 200):
        if item.answer.kind == "choice":
            assert len(item.choices) >= 2 and len(set(item.choices)) == len(item.choices), item.id
        else:
            assert answers.check(item.answer.model_dump(), item.answer.value), item.id
        # Nombres négatifs avec le signe moins typographique (−), pas le trait d'union.
        assert not re.search(r"(^|[\s(;])-\d", item.prompt.splitlines()[0]), item.id
        assert not item.explanation.startswith(("F(", "A =", "M =", "X ")), item.id


# --- 6e -------------------------------------------------------------------------------


def test_tables():
    for item in _items("6e.automatismes.tables"):
        m = item.meta
        expected = m["a"] * m["b"] if m["case"] == "produit" else m["b"]
        assert _value(item) == expected, item.id


def test_mental():
    for item in _items("6e.automatismes.calcul_mental"):
        m = item.meta
        if m["case"] == "complement":
            assert _value(item) + m["a"] == m["target"]
        elif m["case"] == "addsub":
            a, b = m["a"], m["b"]
            assert _value(item) == (a - b if m["op"] == "−" else a + b), item.id
        elif m["case"] == "astuce":
            assert _value(item) == m["a"] * m["k"]
        else:
            a, b = Decimal(m["a"]), Decimal(m["b"])
            assert _value(item) == Fraction(a - b if m["op"] == "−" else a + b), item.id


UNIT_RANK = {
    u: i
    for units in (
        ["km", "hm", "dam", "m", "dm", "cm", "mm"],
        ["kg", "hg", "dag", "g", "dg", "cg", "mg"],
        ["kL", "hL", "daL", "L", "dL", "cL", "mL"],
    )
    for i, u in enumerate(units)
}


def test_conversions():
    for item in _items("6e.automatismes.conversions"):
        m = item.meta
        shift = UNIT_RANK[m["dst"]] - UNIT_RANK[m["src"]]
        assert shift != 0
        assert _value(item) == Fraction(Decimal(m["value"])) * Fraction(10) ** shift, item.id


def test_times_ten():
    for item in _items("6e.nombres.multiplier_diviser_10"):
        m = item.meta
        value = Fraction(Decimal(m["value"]))
        assert _value(item) == (value / m["k"] if m["divide"] else value * m["k"]), item.id


def test_compare_decimals():
    for item in _items("6e.nombres.comparer_decimaux"):
        values = [Decimal(v) for v in item.meta["values"]]
        target = min(values) if item.meta["smallest"] else max(values)
        assert Decimal(_choice(item).replace(",", ".")) == target, item.id
        assert len(set(values)) == 4


def test_division():
    for item in _items("6e.nombres.division_euclidienne"):
        m = item.meta
        q, r = divmod(m["dividend"], m["divisor"])
        assert (q, r) == (m["quotient"], m["remainder"]) and 2 <= m["divisor"] <= 9
        assert _value(item) == (r if m["ask_remainder"] else q), item.id


def test_quantity():
    for item in _items("6e.fractions.quantite"):
        m = item.meta
        assert m["n"] < m["d"], item.id  # « les 6/6 de » ne se dit pas
        assert _value(item) == Fraction(m["n"], m["d"]) * m["total"]


def test_bracket():
    for item in _items("6e.fractions.encadrement"):
        m = item.meta
        f = Fraction(m["n"], m["d"])
        assert m["k"] < f < m["k"] + 1, item.id
        if item.type == "mcq":
            assert _choice(item) == f"{m['k']} et {m['k'] + 1}"
        else:
            assert _value(item) == m["k"]


def test_bars_patterns_area_triangle():
    for item in _items("6e.prealgebre.schema_barres"):
        assert _value(item) == item.meta["result"] and item.meta["result"] > 0
    for item in _items("6e.prealgebre.suites_motifs"):
        m = item.meta
        term = m["start"] + m["step"] * (m["rank"] - 1)
        assert _value(item) == (
            m["rank"] if "value" in m and "À quel rang" in item.prompt else term
        ), item.id
    for item in _items("6e.grandeurs.aire_rectangle"):
        m = item.meta
        area = m["a"] * m["b"]
        assert _value(item) in (area, m["a"]), item.id
        assert str(area) in item.prompt or _value(item) == area
    for item in _items("6e.angles.somme_triangle"):
        angles = item.meta["angles"]
        assert sum(angles) == 180 and all(0 < a < 180 for a in angles), item.id
        assert _value(item) in angles


def test_durations():
    for item in _items("6e.grandeurs.durees"):
        m = item.meta
        if "end_minutes" in m:
            end = m["start"] + m["duration"]
            assert (
                (end // 60, end % 60)
                == (m["end_hour"], m["end_minutes"])
                == (m["end_hour"], _value(item))
            )
        elif "end" in m:
            assert _value(item) == m["end"] - m["start"] > 0
        else:
            assert _value(item) == m["result"]


def test_unit_rate_and_scales():
    for item in _items("6e.proportionnalite.retour_unite"):
        m = item.meta
        assert _value(item) == Fraction(Decimal(m["unit"])) * m["m"], item.id
    for item in _items("6e.proportionnalite.echelles"):
        m = item.meta
        real_cm = m["cm"] * m["scale"]
        assert _value(item) in (real_cm, Fraction(real_cm, 100000), m["cm"]), item.id


def test_probability():
    for item in _items("6e.probabilites.equiprobabilite"):
        m = item.meta
        p = Fraction(m["favorable"], m.get("total", 6))
        if item.type == "mcq":
            assert Fraction(_choice(item)) == p
        else:
            assert _value(item) == p
        assert 0 < p < 1 or m["favorable"] == m.get("total")


# --- 2nde ------------------------------------------------------------------------------


def _sup_to_int(text):
    digits = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
    base = "".join(ch for ch in text if ch.isdigit() and ch.isascii())
    return int(base), int("".join(ch for ch in text if not ch.isascii()).translate(digits))


def test_powers():
    for item in _items("2nde.calcul.puissances"):
        base, exp = _sup_to_int(_choice(item))
        assert (base, exp) == (item.meta["a"], item.meta["exp"]), item.id
        # Le LaTeX vaut bien cette puissance.
        expr = sympy.sympify(
            item.latex.replace("\\times", "*")
            .replace("\\left", "")
            .replace("\\right", "")
            .replace("\\frac{", "(")
            .replace("}{", ")/(")
            .replace("^{", "**(")
            .replace("}", ")")
        )
        assert sympy.nsimplify(expr) == sympy.Integer(base) ** exp, item.id


def test_roots():
    for item in _items("2nde.calcul.racines"):
        m = item.meta
        chosen = _choice(item)
        if "n" in m:
            assert sympy.sqrt(m["n"]) == sympy.sympify(chosen.replace("√", "*sqrt(") + ")"), item.id
        elif "j" in m:
            k, j, s = m["k"], m["j"], m["s"]
            assert sympy.sqrt(k * k * s) + sympy.sqrt(j * j * s) == sympy.sympify(
                chosen.replace("√", "*sqrt(") + ")"
            )
        else:
            assert sympy.sqrt(m["a"] + m["b"]) == int(chosen)


def test_fraction_automatism():
    ops = {
        "+": lambda a, b: a + b,
        "−": lambda a, b: a - b,
        "×": lambda a, b: a * b,
        "÷": lambda a, b: a / b,
    }
    for item in _items("2nde.automatismes.fractions"):
        m = item.meta
        assert _value(item) == ops[m["op"]](Fraction(m["f1"]), Fraction(m["f2"])), item.id


def _interval_contains(text, x):
    left, right = text[0], text[-1]
    lo, hi = (part.strip().replace("−", "-") for part in text[1:-1].split(";"))
    lo_ok = lo == "-∞" or (x >= Fraction(lo) if left == "[" else x > Fraction(lo))
    hi_ok = hi == "+∞" or (x <= Fraction(hi) if right == "]" else x < Fraction(hi))
    return lo_ok and hi_ok


def test_intervals_and_absolute_value():
    probes = [Fraction(n, 4) for n in range(-80, 81)]
    for item in _items("2nde.reels.intervalles"):
        m = item.meta
        chosen = _choice(item)
        if "lc" in m:

            def rule(x, m=m):
                return (x >= m["a"] if m["lc"] else x > m["a"]) and (
                    x <= m["b"] if m["rc"] else x < m["b"]
                )
        elif "sign" in m:
            a, sign = m["a"], m["sign"]

            def rule(x, a=a, sign=sign):
                return {"≥": x >= a, ">": x > a, "≤": x <= a, "<": x < a}[sign]
        else:

            def rule(x, m=m):
                first, second = m["a"] <= x <= m["b"], m["c"] <= x <= m["d"]
                return (first and second) if m["inter"] else (first or second)

        assert all(_interval_contains(chosen, x) == rule(x) for x in probes), item.id
    for item in _items("2nde.valeur_absolue.distance"):
        m = item.meta
        if item.type == "mcq":
            c, r, strict = m["c"], m["r"], m["strict"]
            assert all(
                _interval_contains(_choice(item), x)
                == (abs(x - c) < r if strict else abs(x - c) <= r)
                for x in probes
            ), item.id
        elif "value" in m:
            assert _value(item) == abs(m["value"])
        else:
            assert _value(item) == abs(m["a"] - m["b"])


def test_number_sets():
    expected = {
        "7": "ℕ",
        "12": "ℕ",
        "−3": "ℤ",
        "0,5": "𝔻",
        "−8/2": "ℤ",
        "3/4": "𝔻",
        "1/3": "ℚ",
        "√16": "ℕ",
        "2/3": "ℚ",
        "π": "ℝ",
        "√2": "ℝ",
        "−0,25": "𝔻",
        "√9 − 5": "ℤ",
        "7/20": "𝔻",
        "1/6": "ℚ",
        "√8": "ℝ",
        "(√3)²": "ℕ",
        "√2 × √8": "ℕ",
        "10/12": "ℚ",
        "π/π": "ℕ",
        "1/7": "ℚ",
    }
    for item in _items("2nde.reels.ensembles", 100):
        assert _choice(item) == expected[item.meta["text"]], item.id


def test_image_affine_slope():
    x = sympy.Symbol("x")
    for item in _items("2nde.fonctions.image"):
        m = item.meta
        poly = sum(c * x ** int(k) for k, c in m["coeffs"].items())
        assert _value(item) == poly.subs(x, m["x"]), item.id
    for item in _items("2nde.fonctions.affine"):
        (x1, y1), (x2, y2) = item.meta["points"]
        a = Fraction(y2 - y1, x2 - x1)
        if item.type == "numeric":
            assert _value(item) == a
        else:
            f = _sym(item.answer.value)
            assert f.subs(x, x1) == y1 and f.subs(x, x2) == y2, item.id
    for item in _items("2nde.droites.coefficient"):
        (xa, ya), (xb, yb) = item.meta["a"], item.meta["b"]
        assert _value(item) == Fraction(yb - ya, xb - xa), item.id


def test_zero_product():
    x = sympy.Symbol("x")
    for item in _items("2nde.equations.produit_nul"):
        expr = item.latex.replace("\\left(", "(").replace("\\right)", ")").replace(" = 0", "")
        expr = expr.replace(")(", ")*(")
        expr = "".join(
            f"{c}*" if c.isdigit() and nxt == "x" else c
            for c, nxt in zip(expr, expr[1:] + " ", strict=True)
        )
        solutions = sympy.solve(sympy.sympify(expr), x)
        chosen = _choice(item).strip("{} ").replace("−", "-").split(" ; ")
        assert sorted(Fraction(s) for s in chosen) == sorted(Fraction(str(s)) for s in solutions), (
            item.id
        )


def test_statistics_probability_pythagoras_python():
    for item in _items("2nde.statistiques.moyenne"):
        m = item.meta
        mean = Fraction(
            sum(w * n for w, n in zip(m["weights"], m["notes"], strict=True)), sum(m["weights"])
        )
        assert _value(item) == mean, item.id
    for item in _items("2nde.probabilites.conditionnelles"):
        m = item.meta
        if "table" in m:
            assert _value(item) == Fraction(m["num"], m["den"])
        else:
            pa, pba, pbna = Fraction(m["pa"]), Fraction(m["pba"]), Fraction(m["pbna"])
            both = pa * pba
            assert _value(item) in (both, both + (1 - pa) * pbna), item.id
    for item in _items("2nde.automatismes.pythagore"):
        m = item.meta
        if "c" in m:
            assert m["a"] ** 2 + m["b"] ** 2 == m["c"] ** 2
            assert _value(item) in (m["b"], m["c"])
        else:
            assert Fraction(m["am"], 1) / Fraction(m["ab"]) == Fraction(m["an"]) / _value(item), (
                item.id
            )
    for item in _items("2nde.python.lecture"):
        scope: dict = {}
        exec(
            "\n".join(item.meta["code"]), {}, scope
        )  # code produit par le générateur, pas par l'utilisateur
        assert _value(item) == scope["x"], item.id


# --- Widgets interactifs ------------------------------------------------------------------


def test_number_line():
    for item in _items("6e.fractions.droite_graduee"):
        v, m = item.visual, item.meta
        value = Fraction(m["value"])
        assert v["min"] < value < v["max"], item.id
        # Le point tombe pile sur une graduation, jamais sur un entier.
        assert (value * v["subdivisions"]).denominator == 1 and value.denominator != 1, item.id
        assert answers.check(item.answer.model_dump(), item.answer.value)
        if item.type == "number_line":
            assert v["mode"] == "place"
            # Saisie du client : « k/sub » non simplifié.
            assert answers.check(
                item.answer.model_dump(), f"{int(value * v['subdivisions'])}/{v['subdivisions']}"
            )
        else:
            assert v["mode"] == "read" and Fraction(v["point"]) == value


def test_order_items_have_a_single_strict_order():
    for code in ("6e.nombres.ranger_decimaux", "2nde.reels.ranger"):
        for item in _items(code):
            values = [Fraction(x) for x in item.meta["values"]]
            assert len(set(values)) == len(values), item.id
            ranked = [values[i] for i in item.answer.value]
            assert ranked == sorted(values, reverse=item.meta["descending"]), item.id
            assert sorted(item.answer.value) == list(range(len(item.choices)))
            assert answers.check(item.answer.model_dump(), list(item.answer.value))
            assert not answers.check(item.answer.model_dump(), list(reversed(item.answer.value)))


def test_order_reals_labels_match_values():
    import math

    exact = {
        "√2": math.sqrt(2),
        "π": math.pi,
        "√10": math.sqrt(10),
        "−√0,1": -math.sqrt(0.1),
        "10⁻²": 0.01,
        "0,1³": 0.001,
    }
    for item in _items("2nde.reels.ranger", 200):
        for label, value in zip(item.choices, item.meta["values"], strict=True):
            expected = exact.get(label)
            if expected is None:
                expected = float(Fraction(label.replace("−", "-").replace(",", ".")))
            assert abs(float(Fraction(value)) - expected) < 1e-6, (item.id, label)


def test_graph_reading():
    from app.engine.generators.interactifs import _solutions, _value_at

    for item in _items("2nde.automatismes.lecture_graphique"):
        points = item.visual["points"]
        xs = [p[0] for p in points]
        assert xs == sorted(xs) and xs[0] == item.visual["xmin"] and xs[-1] == item.visual["xmax"]
        assert all(item.visual["ymin"] <= p[1] <= item.visual["ymax"] for p in points)
        m = item.meta
        if "x" in m:
            assert _value_at(points, Fraction(m["x"])) == _value(item), item.id
            continue
        sols = _solutions(points, m["k"])
        # Chaque solution annoncée vérifie f(x) = k, et l'on n'en oublie aucune (balayage fin).
        assert all(_value_at(points, s) == m["k"] for s in sols)
        sweep = [Fraction(n, 8) for n in range(-40, 41)]
        crossings = {s for s in sweep if _value_at(points, s) == m["k"]}
        assert crossings <= set(sols), item.id
        if item.type == "mcq":
            assert int(_choice(item)) == len(sols)
        else:
            assert _value(item) == (max(sols) if m["largest"] else min(sols)), item.id


# --- Raisonnement --------------------------------------------------------------------------


def test_robot_simulated_independently():
    moves = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "O": (-1, 0)}
    right = {"N": "E", "E": "S", "S": "O", "O": "N"}
    left = {v: k for k, v in right.items()}
    for code in ("6e.algorithmique.sequences", "6e.algorithmique.boucles"):
        for item in _items(code):
            v, m = item.visual, item.meta
            x, y = v["start"]
            facing = v["facing"]
            for _ in range(m["repeat"]):
                for op, arg in m["program"]:
                    if op == "avancer":
                        for _ in range(arg):
                            x, y = x + moves[facing][0], y + moves[facing][1]
                            assert 0 <= x < v["size"] and 0 <= y < v["size"], item.id
                    else:
                        facing = right[facing] if op == "droite" else left[facing]
            marks = v["marks"]
            assert marks[_choice(item)] == [x, y], item.id
            cells = [tuple(c) for c in marks.values()]
            assert len(set(cells)) == len(cells) >= 3 and tuple(v["start"]) not in cells, item.id
            assert all(0 <= cx < v["size"] and 0 <= cy < v["size"] for cx, cy in cells)
            assert ("répéter" in item.prompt) == (code.endswith("boucles"))


def test_sign_table():
    for item in _items("2nde.equations.signe"):
        factors = [(a, Fraction(r)) for a, r in item.meta["factors"]]
        roots = sorted({r for _, r in factors})
        assert [Fraction(t.replace("−", "-")) for t in item.visual["roots"]] == roots
        probes = (
            [roots[0] - 1]
            + [(lo + hi) / 2 for lo, hi in zip(roots, roots[1:], strict=False)]
            + [roots[-1] + 1]
        )
        expected = []
        for a, r in factors:
            expected += ["+" if a * (x - r) > 0 else "-" for x in probes]
        if len(factors) == 2:
            expected += [
                "+"
                if (factors[0][0] * (x - factors[0][1])) * (factors[1][0] * (x - factors[1][1])) > 0
                else "-"
                for x in probes
            ]
        assert list(item.answer.value) == expected, item.id
        assert len(item.visual["rows"]) == (3 if len(factors) == 2 else 1)


def test_true_false():
    kinds = {
        "aigu": lambda a: a < 90,
        "droit": lambda a: a == 90,
        "obtus": lambda a: 90 < a < 180,
        "plat": lambda a: a == 180,
    }
    for item in _items("6e.angles.vocabulaire"):
        m = item.meta
        assert kinds[m["real"]](m["angle"]) and item.answer.value == (m["claimed"] == m["real"]), (
            item.id
        )
        assert m["real"] in item.choices[item.answer.reason]
    true_cases = {"multiple", "quadrilatere"}
    for item in _items("2nde.logique.implication"):
        reason = item.choices[item.answer.reason]
        assert item.explanation.startswith("Vrai" if item.answer.value else "Faux"), item.id
        if item.meta["case"] in true_cases:
            assert item.answer.value is True
        elif item.meta["case"] != "ordre_carre":
            assert item.answer.value is False and ("contre-exemple" in reason or "≠" in reason), (
                item.id
            )
        assert len(set(item.choices)) == 3 and "−exemple" not in reason
        assert answers.check(
            item.answer.model_dump(), {"value": item.answer.value, "reason": item.answer.reason}
        )
        assert not answers.check(
            item.answer.model_dump(), {"value": not item.answer.value, "reason": item.answer.reason}
        )


def test_map_distance_measured_on_the_drawing():
    """Énigme de la carte : la distance se retrouve en comptant les carreaux du dessin."""
    for item in _items("6e.proportionnalite.carte"):
        v = item.visual
        path = v.get("path") or [p["at"] for p in v["points"]]
        assert path[0] == v["points"][0]["at"] and path[-1] == v["points"][1]["at"]
        assert all(0 <= x < v["cols"] and 0 <= y < v["rows"] for x, y in path), item.id
        legs = list(zip(path, path[1:], strict=False))
        cells = sum(abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in legs)
        assert all(a[0] == b[0] or a[1] == b[1] for a, b in legs)
        scale = v["scale"]
        if "ratio" in scale:
            expected = Fraction(cells * scale["ratio"], 100000)
            assert "kilomètres" in item.prompt
        else:
            metres = int(scale["text"].removesuffix(" m").replace(" ", ""))
            expected = Fraction(cells * metres, scale["cells"])
            assert "mètres" in item.prompt
        assert _value(item) == expected, item.id
        assert ("route" in item.prompt) == ("path" in v)
        assert v["points"][0]["label"] != v["points"][1]["label"]
