"""Nombres et calculs, seconde (arrêté du 26 février 2026) : ensembles de nombres,
intervalles, valeur absolue et distance, puissances, racines carrées, calcul
fractionnaire sans calculatrice (automatisme de l'épreuve anticipée).

Les QCM reprennent les erreurs classiques : (a^m)^n confondu avec a^(m+n),
√(a+b) = √a + √b, oubli du crochet ouvert, distance confondue avec la différence.
"""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.formatting import frac_latex, frac_text, minus, p, sentence


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
        "explanation": sentence(explanation),
        "time_target_ms": target_ms,
        "meta": meta,
    }
    if latex:
        item["latex"] = latex
    return item


# --- Puissances ---------------------------------------------------------------------------

_SUPERSCRIPT = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")


def power(base: int, exponent: int) -> str:
    """2¹² : exposant en chiffres en exposant (lisible tel quel dans un bouton de QCM)."""
    return f"{base}{str(exponent).translate(_SUPERSCRIPT)}"


def _powers(difficulty: int, rng: random.Random) -> dict:
    a = rng.choice([2, 3, 5, 10]) if difficulty <= 3 else rng.choice([2, 3, 5, 7])
    m, n = rng.randint(2, 6), rng.randint(2, 5)
    case = ["produit", "quotient", "puissance", "produit", "melange"][difficulty - 1]
    if case == "quotient":
        m = n + rng.randint(1, 5)
    if case == "produit":
        exp, latex = m + n, f"{a}^{{{m}}} \\times {a}^{{{n}}}"
        wrong = [m * n, abs(m - n)]
        rule = "a^m × a^n = a^(m+n)"
    elif case == "quotient":
        exp, latex = m - n, f"\\frac{{{a}^{{{m}}}}}{{{a}^{{{n}}}}}"
        wrong = [m + n, m * n]
        rule = "a^m ÷ a^n = a^(m−n)"
    elif case == "puissance":
        exp, latex = m * n, f"\\left({a}^{{{m}}}\\right)^{{{n}}}"
        wrong = [m + n, m**n if m**n < 100 else m * n + 1]
        rule = "(a^m)^n = a^(m×n)"
    else:  # (a^m × a^n) / a^k avec exposants négatifs possibles
        k = rng.randint(2, 12)
        exp = m + n - k
        latex = f"\\frac{{{a}^{{{m}}} \\times {a}^{{{n}}}}}{{{a}^{{{k}}}}}"
        wrong = [m * n - k, m + n + k, k - m - n]
        rule = "On additionne les exposants du produit, puis on soustrait celui du dénominateur"
    correct = power(a, exp)
    distractors = [power(a, w) for w in wrong if w != exp] + [power(a * a, exp), power(a, exp + 1)]
    return _mcq(
        "Écris ce nombre sous la forme d'une seule puissance.",
        correct,
        distractors,
        f"Règle : {rule}.",
        f"{rule} : on obtient {correct}",
        20000 + 7000 * difficulty,
        rng,
        {"a": a, "exp": exp, "case": case},
        latex=latex,
    )


# --- Racines carrées ---------------------------------------------------------------------------


def _roots(difficulty: int, rng: random.Random) -> dict:
    """√(k²·s) = k√s, avec s sans facteur carré (2, 3, 5, 6, 7)."""
    s = rng.choice([2, 3, 5, 6, 7])
    k = rng.randint(2, 4 if difficulty <= 2 else 9)
    if difficulty <= 3:
        n = k * k * s
        correct = f"{k}√{s}"
        distractors = [f"{s}√{k}", f"{k * k}√{s}", f"{k}√{k * s}", f"√{k * s}"]
        return _mcq(
            f"Simplifie √{n}.",
            correct,
            distractors,
            f"Cherche le plus grand carré qui divise {n} : {n} = {k * k} × {s}.",
            f"√{n} = √({k * k} × {s}) = √{k * k} × √{s} = {correct}",
            20000 + 8000 * difficulty,
            rng,
            {"n": n, "k": k, "s": s},
        )
    # Niveaux 4 et 5 : somme de racines (√(a²s) + √(b²s)) ou piège √(a+b).
    j = rng.randint(1, 5)
    while j == k:
        j = rng.randint(1, 5)
    if difficulty == 4:
        n1, n2 = k * k * s, j * j * s
        total = k + j
        correct = f"{total}√{s}"
        return _mcq(
            f"Calcule √{n1} + √{n2}.",
            correct,
            [f"√{n1 + n2}", f"{k * j}√{s}", f"{total}√{2 * s}", f"{total * total}√{s}"],
            "Simplifie chaque racine pour faire apparaître le même radical.",
            f"√{n1} = {k}√{s} et √{n2} = {j}√{s} ; donc {k}√{s} + {j}√{s} = {correct}",
            50000,
            rng,
            {"k": k, "j": j, "s": s},
        )
    a, b = rng.choice([(9, 16), (36, 64), (25, 144), (9, 40)])
    correct = str(int((a + b) ** 0.5))
    return _mcq(
        f"Combien vaut √({a} + {b}) ?",
        correct,
        [
            str(int(a**0.5) + int(b**0.5)) if int(b**0.5) ** 2 == b else f"√{a} + √{b}",
            str(a + b),
            f"{int(a**0.5)} + √{b}",
        ],
        "Attention : la racine d'une somme n'est pas la somme des racines. Calcule d'abord la somme.",
        f"{a} + {b} = {a + b} et √{a + b} = {correct}. Piège : √({a} + {b}) ≠ √{a} + √{b}",
        40000,
        rng,
        {"a": a, "b": b},
    )


# --- Calcul fractionnaire (automatisme) -------------------------------------------------------


def _fractions(difficulty: int, rng: random.Random) -> dict:
    def frac(sign_ok: bool) -> Fraction:
        d = rng.randint(2, 9)
        n = rng.randint(1, 2 * d)
        while n % d == 0:
            n = rng.randint(1, 2 * d)
        if sign_ok and rng.random() < 0.4:
            n = -n
        return Fraction(n, d)

    negatives = difficulty >= 3
    f1, f2 = frac(negatives), frac(negatives)
    while f2 == f1:
        f2 = frac(negatives)
    op = {1: "+", 2: "×", 3: "−", 4: "÷", 5: rng.choice("+−×÷")}[difficulty]
    if op == "+":
        result, rule = f1 + f2, "Même dénominateur d'abord, puis on ajoute les numérateurs."
    elif op == "−":
        result, rule = f1 - f2, "Même dénominateur d'abord, puis on soustrait les numérateurs."
    elif op == "×":
        result, rule = (
            f1 * f2,
            "On multiplie les numérateurs entre eux et les dénominateurs entre eux.",
        )
    else:
        result, rule = f1 / f2, "Diviser par une fraction, c'est multiplier par son inverse."
    latex_op = {"+": "+", "−": "-", "×": "\\times", "÷": "\\div"}[op]
    right = frac_latex(f2.numerator, f2.denominator)
    if f2 < 0:
        right = f"\\left({right}\\right)"
    return {
        "type": "numeric",
        "prompt": "Calcule sans calculatrice ; donne le résultat sous forme de fraction irréductible ou d'entier.",
        "latex": f"{frac_latex(f1.numerator, f1.denominator)} {latex_op} {right}",
        "answer": {"kind": "fraction", "value": frac_text(result), "accept_equivalent": True},
        "hint": rule,
        "explanation": sentence(
            minus(
                f"{frac_text(f1)} {op} {frac_text(f2) if f2 >= 0 else '(' + frac_text(f2) + ')'} = {frac_text(result)}. {rule}"
            )
        ),
        "time_target_ms": 30000 + 8000 * difficulty,
        "meta": {"f1": str(f1), "f2": str(f2), "op": op, "result": str(result)},
    }


# --- Intervalles -------------------------------------------------------------------------------


def _interval_text(a, b, left_closed: bool, right_closed: bool) -> str:
    left = "[" if left_closed else "]"
    right = "]" if right_closed else "["
    return minus(f"{left}{a} ; {b}{right}")


def _intervals(difficulty: int, rng: random.Random) -> dict:
    a = rng.randint(-8, 4)
    b = a + rng.randint(2, 9)
    if difficulty <= 2:  # inégalités → intervalle
        lc, rc = rng.random() < 0.5, rng.random() < 0.5
        left = "≤" if lc else "<"
        right = "≤" if rc else "<"
        correct = _interval_text(a, b, lc, rc)
        distractors = [
            _interval_text(a, b, not lc, rc),
            _interval_text(a, b, lc, not rc),
            _interval_text(a, b, not lc, not rc),
        ]
        return _mcq(
            minus(f"L'ensemble des réels x tels que {a} {left} x {right} {b} est :"),
            correct,
            distractors,
            "Crochet tourné vers le nombre : la borne est comprise ; tourné vers l'extérieur : elle est exclue.",
            minus(
                f"{a} est {'compris' if lc else 'exclu'}, {b} est {'compris' if rc else 'exclu'} : {correct}"
            ),
            20000 + 5000 * difficulty,
            rng,
            {"a": a, "b": b, "lc": lc, "rc": rc},
        )
    if difficulty == 3:  # demi-droite
        lc = rng.random() < 0.5
        greater = rng.random() < 0.5
        sign = ("≥" if lc else ">") if greater else ("≤" if lc else "<")
        bracket_in = "[" if lc else "]"
        bracket_out = "]" if lc else "["
        other_in, other_out = ("]", "[") if lc else ("[", "]")
        if greater:
            correct = minus(f"{bracket_in}{a} ; +∞[")
            distractors = [
                f"]−∞ ; {a}{bracket_out}",
                f"{other_in}{a} ; +∞[",
                f"{bracket_in}{a} ; +∞]",
            ]
        else:
            correct = minus(f"]−∞ ; {a}{bracket_out}")
            distractors = [
                f"{bracket_in}{a} ; +∞[",
                f"]−∞ ; {a}{other_out}",
                f"[−∞ ; {a}{bracket_out}",
            ]
        distractors = [minus(d) for d in distractors]
        return _mcq(
            minus(f"L'ensemble des réels x tels que x {sign} {a} est :"),
            correct,
            distractors,
            "Du côté de l'infini, le crochet est toujours ouvert.",
            minus(f"x {sign} {a} : {correct}"),
            30000,
            rng,
            {"a": a, "sign": sign},
        )
    # Niveaux 4 et 5 : intersection ou réunion de deux intervalles fermés qui se chevauchent.
    c = rng.randint(a + 1, b - 1)
    d = b + rng.randint(1, 6)
    inter = difficulty == 4 or rng.random() < 0.5
    first, second = minus(f"[{a} ; {b}]"), minus(f"[{c} ; {d}]")
    correct = minus(f"[{c} ; {b}]") if inter else minus(f"[{a} ; {d}]")
    distractors = [
        minus(f"[{a} ; {d}]") if inter else minus(f"[{c} ; {b}]"),
        minus(f"[{a} ; {c}]"),
        minus(f"[{b} ; {d}]"),
    ]
    word = "l'intersection" if inter else "la réunion"
    return _mcq(
        f"Quelle est {word} de {first} et {second} ?",
        correct,
        distractors,
        "Dessine les deux intervalles sur une même droite graduée. Intersection : la partie commune ; réunion : tout ce qui est couvert.",
        f"{'Partie commune' if inter else 'Tout ce qui est couvert'} : {correct}",
        35000 + 5000 * difficulty,
        rng,
        {"a": a, "b": b, "c": c, "d": d, "inter": inter},
    )


# --- Valeur absolue et distance -------------------------------------------------------------


def _absolute(difficulty: int, rng: random.Random) -> dict:
    a, b = rng.randint(-12, 12), rng.randint(-12, 12)
    while a == b:
        b = rng.randint(-12, 12)
    if difficulty <= 2:
        value = a - b if difficulty == 2 else a
        return {
            "type": "numeric",
            "prompt": minus(
                f"Combien vaut |{a - b if difficulty == 2 else a}| ?"
                if difficulty == 1
                else f"Combien vaut |{a} − {p(b)}| ?"
            ),
            "answer": {"kind": "number", "value": str(abs(value))},
            "hint": "La valeur absolue d'un nombre est sa distance à zéro : elle est toujours positive ou nulle.",
            "explanation": sentence(minus(f"|{value}| = {abs(value)}")),
            "time_target_ms": 15000 + 5000 * difficulty,
            "meta": {"value": value},
        }
    if difficulty == 3:  # distance entre deux réels
        return {
            "type": "numeric",
            "prompt": minus(f"Sur une droite graduée, quelle est la distance entre {a} et {b} ?"),
            "answer": {"kind": "number", "value": str(abs(a - b))},
            "hint": "La distance entre a et b est |a − b|.",
            "explanation": sentence(minus(f"|{a} − {p(b)}| = |{a - b}| = {abs(a - b)}")),
            "time_target_ms": 30000,
            "meta": {"a": a, "b": b},
        }
    # Niveaux 4 et 5 : |x − c| ≤ r (ou < r) ↔ intervalle.
    c, r = rng.randint(-6, 6), rng.randint(1, 6)
    strict = difficulty == 5 and rng.random() < 0.5
    sign = "<" if strict else "≤"
    lo, hi = c - r, c + r
    correct = _interval_text(lo, hi, not strict, not strict)
    distractors = [
        _interval_text(-r - c, r - c, not strict, not strict),  # signe de c oublié
        _interval_text(c, c + r, not strict, not strict),
        _interval_text(lo, hi, strict, strict),
    ]
    inner = f"x − {c}" if c >= 0 else f"x + {-c}"
    return _mcq(
        minus(f"L'ensemble des réels x tels que |{inner}| {sign} {r} est :"),
        correct,
        distractors,
        minus(
            f"|x − c| {sign} r : la distance de x à c est {'inférieure' if strict else 'au plus'} {'à ' if strict else ''}r."
        ),
        minus(
            f"La distance de x à {c} est {'inférieure à' if strict else 'au plus'} {r} : x va de {lo} à {hi}, soit {correct}"
        ),
        40000 + 5000 * difficulty,
        rng,
        {"c": c, "r": r, "strict": strict},
    )


# --- Ensembles de nombres ---------------------------------------------------------------------

_SETS = ["ℕ", "ℤ", "𝔻", "ℚ", "ℝ"]


def _sets(difficulty: int, rng: random.Random) -> dict:
    """Le plus petit ensemble contenant un nombre donné (ℕ ⊂ ℤ ⊂ 𝔻 ⊂ ℚ ⊂ ℝ)."""
    pool = {
        1: [("7", 0), ("−3", 1), ("0,5", 2), ("12", 0)],
        2: [("−8/2", 1), ("3/4", 2), ("1/3", 3), ("√16", 0)],
        3: [("2/3", 3), ("π", 4), ("√2", 4), ("−0,25", 2)],
        4: [("√9 − 5", 1), ("7/20", 2), ("1/6", 3), ("√8", 4)],
        5: [("(√3)²", 0), ("√2 × √8", 0), ("10/12", 3), ("π/π", 0), ("1/7", 3)],
    }[difficulty]
    text, idx = rng.choice(pool)
    correct = _SETS[idx]
    distractors = [s for s in _SETS if s != correct]
    rng.shuffle(distractors)
    reasons = [
        "c'est un entier naturel",
        "c'est un entier négatif (ou une écriture qui vaut un entier négatif)",
        "c'est un décimal : il s'écrit avec un nombre fini de chiffres après la virgule",
        "c'est un quotient d'entiers, mais pas un décimal (écriture décimale infinie)",
        "c'est un irrationnel : il ne s'écrit pas comme un quotient d'entiers",
    ]
    return _mcq(
        minus(f"Quel est le plus petit ensemble de nombres qui contient {text} ?"),
        correct,
        distractors,
        "ℕ ⊂ ℤ ⊂ 𝔻 ⊂ ℚ ⊂ ℝ. Simplifie d'abord l'écriture si tu peux.",
        minus(f"{text} : {reasons[idx]}, donc {correct}"),
        15000 + 6000 * difficulty,
        rng,
        {"text": text, "set": correct},
    )


def _gen(code, notion, role, title, fn) -> Generator:
    return register(
        Generator(code=code, level="2nde", notion=notion, role=role, title=title, generate=fn)
    )


POWERS = _gen(
    "2nde.calcul.puissances",
    "2nde.maths.calcul_litteral.puissances",
    "chapitre",
    "Puissances",
    _powers,
)
ROOTS = _gen(
    "2nde.calcul.racines",
    "2nde.maths.calcul_litteral.racines",
    "chapitre",
    "Racines carrées",
    _roots,
)
FRACTIONS = _gen(
    "2nde.automatismes.fractions",
    "2nde.maths.automatismes.fractions",
    "automatisme",
    "Calcul fractionnaire",
    _fractions,
)
INTERVALS = _gen(
    "2nde.reels.intervalles", "2nde.maths.reels.intervalles", "chapitre", "Intervalles", _intervals
)
ABSOLUTE = _gen(
    "2nde.valeur_absolue.distance",
    "2nde.maths.valeur_absolue.distance",
    "chapitre",
    "Valeur absolue et distance",
    _absolute,
)
SETS = _gen(
    "2nde.reels.ensembles", "2nde.maths.reels.ensembles", "chapitre", "Ensembles de nombres", _sets
)
