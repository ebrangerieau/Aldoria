"""Raisonnement (phase 3) : vrai ou faux justifié, tableau de signes, robot sur une
grille.

- Vrai ou faux justifié : un « Faux » donné au hasard ne suffit pas, il faut aussi la
  bonne justification (souvent un contre-exemple : programme de seconde, logique).
- Tableau de signes : le client affiche les valeurs qui annulent chaque facteur ;
  l'élève complète les signes, ligne par ligne.
- Robot : séquences d'instructions et boucles (programme 2025 de 6e, pensée informatique).
"""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.developper_2nde import _pretty, poly_text
from app.engine.generators.formatting import frac_text, minus, sentence


def _true_false(statement, value, correct, distractors, hint, target_ms, rng, meta) -> dict:
    reasons = [correct, *distractors[:2]]
    rng.shuffle(reasons)
    return {
        "type": "true_false",
        "prompt": statement,
        "choices": reasons,
        "answer": {"kind": "true_false", "value": value, "reason": reasons.index(correct)},
        "hint": hint,
        "explanation": sentence(f"{'Vrai' if value else 'Faux'} : {correct}"),
        "time_target_ms": target_ms,
        "meta": meta | {"value": value},
    }


# --- Logique : implication, réciproque, contre-exemple (2nde) ------------------------------


def _logic(difficulty: int, rng: random.Random) -> dict:
    a = rng.randint(2, 9)
    n = rng.choice([4, 6, 10, 15])
    templates = {
        1: ["carre", "abs"],
        2: ["carre", "multiple", "reciproque_multiple"],
        3: ["ordre_carre", "identite", "quadrilatere"],
        4: ["ordre_carre", "identite", "reciproque_quadrilatere", "inverse"],
        5: ["ordre_carre", "inverse", "reciproque_multiple", "racine"],
    }[difficulty]
    case = rng.choice(templates)
    if case == "carre":
        return _true_false(
            f"Pour tout réel x : si x² = {a * a}, alors x = {a}.",
            False,
            f"contre-exemple : x = −{a} vérifie x² = {a * a}, mais x ≠ {a}",
            [
                f"on prend la racine carrée des deux côtés, donc x = {a}",
                f"x² = {a * a} n'a aucune solution",
            ],
            "Une affirmation « pour tout » est fausse dès qu'on trouve un seul contre-exemple. Pense aux négatifs.",
            30000,
            rng,
            {"case": case, "a": a},
        )
    if case == "abs":
        return _true_false(
            "Pour tout réel x : |x| = x.",
            False,
            f"contre-exemple : |−{a}| = {a}, et non −{a}",
            ["la valeur absolue ne change jamais un nombre", "c'est vrai seulement pour x = 0"],
            "Essaie avec un nombre négatif.",
            25000,
            rng,
            {"case": case, "a": a},
        )
    if case == "multiple":
        return _true_false(
            f"Si un entier est multiple de {2 * n}, alors il est multiple de {n}.",
            True,
            f"{2 * n} = 2 × {n}, donc un multiple de {2 * n} s'écrit {2 * n}k = {n} × (2k)",
            [
                f"contre-exemple : {n} est multiple de {n} mais pas de {2 * n}",
                f"{2 * n} n'est pas un multiple de {n}",
            ],
            f"Écris un multiple de {2 * n} sous la forme {2 * n}k.",
            35000,
            rng,
            {"case": case, "n": n},
        )
    if case == "reciproque_multiple":
        return _true_false(
            f"Si un entier est multiple de {n}, alors il est multiple de {2 * n}.",
            False,
            f"contre-exemple : {n} est multiple de {n} mais pas de {2 * n}",
            [f"{2 * n} = 2 × {n}, donc c'est la même chose", f"tout multiple de {n} est pair"],
            "C'est la réciproque d'une propriété vraie : elle n'est pas forcément vraie. Cherche un contre-exemple.",
            40000,
            rng,
            {"case": case, "n": n},
        )
    if case == "ordre_carre":
        negative = rng.random() < 0.6
        if negative:
            return _true_false(
                "Pour tous réels x et y : si x < y, alors x² < y².",
                False,
                f"contre-exemple : −{a} < 1 mais (−{a})² = {a * a} > 1",
                [
                    "la fonction carré est croissante sur ℝ",
                    "on peut élever les deux membres au carré",
                ],
                "La fonction carré est décroissante sur ]−∞ ; 0]. Teste avec des nombres négatifs.",
                45000,
                rng,
                {"case": case, "a": a},
            )
        return _true_false(
            "Pour tous réels positifs x et y : si x < y, alors x² < y².",
            True,
            "la fonction carré est croissante sur [0 ; +∞[",
            [
                f"contre-exemple : −{a} < 1 mais (−{a})² > 1",
                "le carré change l'ordre de deux nombres",
            ],
            "Sur [0 ; +∞[, comment varie la fonction carré ?",
            45000,
            rng,
            {"case": case, "a": a},
        )
    if case == "identite":
        return _true_false(
            f"Pour tout réel x : (x + {a})² = x² + {a * a}.",
            False,
            f"(x + {a})² = x² + {2 * a}x + {a * a} ; pour x = 1 : {(1 + a) ** 2} ≠ {1 + a * a}",
            ["le carré d'une somme est la somme des carrés", f"c'est vrai seulement pour x = {a}"],
            "Développe avec l'identité remarquable (a + b)² = a² + 2ab + b², ou teste x = 1.",
            40000,
            rng,
            {"case": case, "a": a},
        )
    if case == "quadrilatere":
        return _true_false(
            "Si un quadrilatère est un carré, alors c'est un rectangle.",
            True,
            "un carré a quatre angles droits, c'est donc un rectangle (particulier)",
            [
                "contre-exemple : un rectangle de côtés 2 et 3 n'est pas un carré",
                "un carré a ses côtés égaux, pas un rectangle",
            ],
            "Rappelle la définition d'un rectangle : un quadrilatère qui a quatre angles droits.",
            30000,
            rng,
            {"case": case},
        )
    if case == "reciproque_quadrilatere":
        return _true_false(
            "Si un quadrilatère est un rectangle, alors c'est un carré.",
            False,
            "contre-exemple : un rectangle de 2 cm sur 3 cm n'a pas ses côtés égaux",
            [
                "un carré est un rectangle, donc l'inverse est vrai aussi",
                "tout rectangle a quatre côtés égaux",
            ],
            "Une réciproque n'est pas toujours vraie : cherche un rectangle qui n'est pas un carré.",
            35000,
            rng,
            {"case": case},
        )
    if case == "inverse":
        return _true_false(
            "Pour tous réels non nuls x et y : si x < y, alors 1/x > 1/y.",
            False,
            f"contre-exemple : −{a} < {a} mais 1/(−{a}) < 1/{a}",
            [
                "la fonction inverse est décroissante, donc l'ordre change toujours",
                "on multiplie les deux membres par xy",
            ],
            "La fonction inverse est décroissante sur chacun des intervalles ]−∞ ; 0[ et ]0 ; +∞[ séparément.",
            50000,
            rng,
            {"case": case, "a": a},
        )
    # racine : √(x²) = x
    return _true_false(
        "Pour tout réel x : √(x²) = x.",
        False,
        f"contre-exemple : √((−{a})²) = √{a * a} = {a}, et non −{a} ; en fait √(x²) = |x|",
        ["la racine carrée annule le carré", "c'est vrai seulement pour x = 0"],
        "Teste avec un nombre négatif : que vaut √((−3)²) ?",
        45000,
        rng,
        {"case": case, "a": a},
    )


# --- Vocabulaire des angles (6e) --------------------------------------------------------------


def _angle_kind(angle: int) -> str:
    if angle < 90:
        return "aigu"
    if angle == 90:
        return "droit"
    if angle < 180:
        return "obtus"
    return "plat"


_KIND_REASON = {
    "aigu": "il mesure moins de 90°, c'est un angle aigu",
    "droit": "il mesure exactement 90°, c'est un angle droit",
    "obtus": "il mesure entre 90° et 180°, c'est un angle obtus",
    "plat": "il mesure 180°, c'est un angle plat",
}


def _angle_words(difficulty: int, rng: random.Random) -> dict:
    angle = rng.choice(
        {1: [30, 45, 90, 120, 180], 2: [60, 90, 135, 150, 180]}.get(
            difficulty, [rng.randint(10, 89), 90, rng.randint(91, 179), 180, rng.choice([89, 91])]
        )
    )
    real = _angle_kind(angle)
    claimed = real if rng.random() < 0.45 else rng.choice([k for k in _KIND_REASON if k != real])
    value = claimed == real
    correct = _KIND_REASON[real]
    wrong_kinds = [k for k in _KIND_REASON if k not in (real, claimed)]
    rng.shuffle(wrong_kinds)
    # Si l'affirmation est fausse, la justification « piège » est celle du mot annoncé.
    distractors = [_KIND_REASON[k] for k in ([] if value else [claimed]) + wrong_kinds][:2]
    return _true_false(
        f"Un angle de {angle}° est un angle {claimed}.",
        value,
        correct,
        distractors,
        "Aigu : moins de 90° ; droit : 90° ; obtus : entre 90° et 180° ; plat : 180°.",
        20000 + 4000 * difficulty,
        rng,
        {"angle": angle, "claimed": claimed, "real": real},
    )


# --- Tableau de signes (2nde) ---------------------------------------------------------------


def _nonzero(rng: random.Random, low: int, high: int) -> int:
    return rng.choice([v for v in range(low, high + 1) if v != 0])


def _sign_of_linear(
    a: int, root: Fraction, intervals: list[tuple[Fraction | None, Fraction | None]]
) -> list[str]:
    """Signe de a·(x − root) sur chaque intervalle (milieu de l'intervalle)."""
    signs = []
    for lo, hi in intervals:
        if lo is None:
            x = hi - 1
        elif hi is None:
            x = lo + 1
        else:
            x = (lo + hi) / 2
        signs.append("+" if a * (x - root) > 0 else "-")
    return signs


def _sign_table(difficulty: int, rng: random.Random) -> dict:
    count = 1 if difficulty == 1 else 2
    factors = []
    while True:
        factors = []
        for _ in range(count):
            a = rng.randint(1, 4) if difficulty <= 2 else _nonzero(rng, -4, 4)
            root = Fraction(rng.randint(-6, 6))
            if difficulty >= 4 and rng.random() < 0.6:
                root = Fraction(_nonzero(rng, -9, 9), abs(a) if abs(a) > 1 else 2)
                a = a if abs(a) > 1 else 2 * a
            factors.append((a, root))
        if len({f[1] for f in factors}) == count and all(
            (a * r).denominator == 1 for a, r in factors
        ):
            break
    quotient = difficulty == 5
    roots = sorted({r for _, r in factors})
    bounds = [None, *roots, None]
    intervals = list(zip(bounds[:-1], bounds[1:], strict=True))
    rows = []
    signs: list[str] = []
    for a, r in factors:
        b = -a * r
        expr = poly_text({k: v for k, v in {1: a, 0: int(b)}.items() if v != 0})
        rows.append(minus(_pretty(expr)))
        signs += _sign_of_linear(a, r, intervals)
    if count == 2:
        product = [
            "+" if signs[i] == signs[i + len(intervals)] else "-" for i in range(len(intervals))
        ]
        signs += product
        rows.append("quotient" if quotient else "produit")
    title = (
        f"({rows[0]}) / ({rows[1]})"
        if quotient
        else (f"({rows[0]})({rows[1]})" if count == 2 else rows[0])
    )
    root_texts = [minus(frac_text(r)) for r in roots]
    details = " ; ".join(
        f"{row} s'annule en x = {minus(frac_text(r))}, positif à {'droite' if a > 0 else 'gauche'} de cette valeur"
        for row, (a, r) in zip(rows, factors, strict=False)
    )
    return {
        "type": "sign_table",
        "prompt": minus(
            f"Complète le tableau de signes de {title} (touche une case pour changer son signe)."
        ),
        "answer": {"kind": "signs", "value": signs},
        "hint": "ax + b est du signe de a à droite de sa racine −b/a, du signe contraire à gauche. "
        "Pour un produit ou un quotient : règle des signes.",
        "explanation": sentence(
            minus(details + (" ; puis règle des signes, colonne par colonne" if count == 2 else ""))
        ),
        "time_target_ms": 40000 + 10000 * difficulty,
        "visual": {"kind": "sign_table", "roots": root_texts, "rows": rows, "quotient": quotient},
        "meta": {"factors": [[a, str(r)] for a, r in factors]},
    }


# --- Robot sur une grille (6e) -------------------------------------------------------------------

_DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "O": (-1, 0)}
_ORDER = ["N", "E", "S", "O"]
_FACING = {"N": "vers le haut", "E": "vers la droite", "S": "vers le bas", "O": "vers la gauche"}


def _run(start, facing, program, size, repeat=1, wrong_turns=False):
    x, y = start
    d = _ORDER.index(facing)
    for _ in range(repeat):
        for op, arg in program:
            if op == "avancer":
                dx, dy = _DIRS[_ORDER[d]]
                for _ in range(arg):
                    x, y = x + dx, y + dy
                    if not (0 <= x < size and 0 <= y < size):
                        return None
            else:
                turn = 1 if op == "droite" else -1
                d = (d + (-turn if wrong_turns else turn)) % 4
    return x, y


def _program_text(program) -> list[str]:
    return [f"avancer de {arg}" if op == "avancer" else f"tourner à {op}" for op, arg in program]


def _robot(difficulty: int, rng: random.Random, loops: bool) -> dict:
    size = 6
    for _ in range(500):
        start = (rng.randrange(size), rng.randrange(size))
        facing = rng.choice(_ORDER)
        length = (1 if difficulty == 1 else 2) + (difficulty >= 4)
        program: list[tuple[str, int]] = []
        for i in range(length):
            program.append(("avancer", rng.randint(1, 3)))
            if i < length - 1 or (loops and rng.random() < 0.7):
                program.append((rng.choice(["droite", "gauche"]), 0))
        repeat = rng.randint(2, 3 if difficulty <= 3 else 4) if loops else 1
        end = _run(start, facing, program, size, repeat)
        if end is None or end == start:
            continue
        opposite = _ORDER[(_ORDER.index(facing) + 2) % 4]
        rotated = _ORDER[(_ORDER.index(facing) + 1) % 4]
        shorter = [(op, max(0, arg - 1) if op == "avancer" else arg) for op, arg in program]
        longer = [(op, arg + 1 if op == "avancer" else arg) for op, arg in program]
        candidates = {
            _run(
                start, facing, program, size, repeat, wrong_turns=True
            ),  # droite et gauche confondues
            _run(start, facing, program, size, repeat - 1)
            if repeat > 1
            else None,  # une répétition de moins
            _run(start, facing, longer, size, repeat),  # une case de trop à chaque pas
            _run(start, facing, shorter, size, repeat),  # une case de moins
            _run(start, opposite, program, size, repeat),  # mauvaise direction de départ
            _run(start, rotated, program, size, repeat),
        }
        candidates = [c for c in candidates if c is not None and c != end and c != start]
        if len(candidates) >= 2:
            break
    rng.shuffle(candidates)
    cells = [end, *candidates[:3]]
    rng.shuffle(cells)
    letters = "ABCD"[: len(cells)]
    marks = {letter: list(cell) for letter, cell in zip(letters, cells, strict=True)}
    correct = letters[cells.index(end)]
    lines = _program_text(program)
    if loops:
        listing = f"répéter {repeat} fois :\n" + "\n".join(f"    {line}" for line in lines)
    else:
        listing = "\n".join(lines)
    return {
        "type": "mcq",
        "prompt": f"Le robot part de la case verte, tourné {_FACING[facing]}. Sur quelle case arrive-t-il ?\n\n{listing}",
        "choices": list(letters),
        "answer": {"kind": "choice", "index": letters.index(correct)},
        "hint": "Suis le programme case par case avec ton doigt. « Tourner » ne fait pas avancer : "
        "le robot change seulement de direction."
        + (" La boucle répète tout le bloc." if loops else ""),
        "explanation": sentence(
            f"En exécutant le programme{' ' + str(repeat) + ' fois' if loops else ''}, "
            f"le robot arrive sur la case {correct}"
        ),
        "time_target_ms": 35000 + 10000 * difficulty,
        "visual": {
            "kind": "robot",
            "size": size,
            "start": list(start),
            "facing": facing,
            "marks": marks,
        },
        "meta": {
            "start": list(start),
            "facing": facing,
            "program": program,
            "repeat": repeat,
            "end": list(end),
        },
    }


def _sequences(difficulty: int, rng: random.Random) -> dict:
    return _robot(difficulty, rng, loops=False)


def _loops(difficulty: int, rng: random.Random) -> dict:
    return _robot(difficulty, rng, loops=True)


LOGIC = register(
    Generator(
        code="2nde.logique.implication",
        level="2nde",
        notion="2nde.maths.logique.implication",
        role="chapitre",
        title="Vrai ou faux : implication, contre-exemple",
        generate=_logic,
    )
)
ANGLE_WORDS = register(
    Generator(
        code="6e.angles.vocabulaire",
        level="6e",
        notion="6e.maths.angles.vocabulaire",
        role="chapitre",
        title="Vocabulaire des angles",
        generate=_angle_words,
    )
)
SIGN_TABLE = register(
    Generator(
        code="2nde.equations.signe",
        level="2nde",
        notion="2nde.maths.equations.signe",
        role="chapitre",
        title="Tableau de signes",
        generate=_sign_table,
    )
)
SEQUENCES = register(
    Generator(
        code="6e.algorithmique.sequences",
        level="6e",
        notion="6e.maths.algorithmique.sequences",
        role="chapitre",
        title="Robot : séquences d'instructions",
        generate=_sequences,
    )
)
LOOPS = register(
    Generator(
        code="6e.algorithmique.boucles",
        level="6e",
        notion="6e.maths.algorithmique.boucles",
        role="chapitre",
        title="Robot : boucles",
        generate=_loops,
    )
)
