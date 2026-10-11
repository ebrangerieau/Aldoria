"""Vecteurs et géométrie repérée, seconde (arrêté du 26 février 2026) : coordonnées,
somme et produit par un réel, colinéarité par le déterminant, milieu et distance
(repère orthonormé)."""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.formatting import fr_number, p

# Triplets pythagoriciens : distances entières, calculables sans calculatrice.
TRIPLES = [(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 16, 20), (7, 24, 25)]


def _nonzero(rng: random.Random, low: int, high: int) -> int:
    return rng.choice([v for v in range(low, high + 1) if v != 0])


def vec(x: Fraction | int, y: Fraction | int) -> str:
    return f"({fr_number(x, 2)} ; {fr_number(y, 2)})"


def _point(name: str, x: Fraction | int, y: Fraction | int) -> str:
    return f"{name}{vec(x, y)}"


def _mcq(prompt, correct, distractors, hint, explanation, difficulty, rng, meta, base=20000):
    choices = [correct]
    for d in distractors:
        if d not in choices:
            choices.append(d)
    choices = choices[:4]
    rng.shuffle(choices)
    return {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(correct)},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": base + 6000 * difficulty,
        "meta": meta,
    }


# --- Coordonnées de vecteurs ------------------------------------------------------------


def _coordinates(difficulty: int, rng: random.Random) -> dict:
    span = 6 if difficulty <= 2 else 12
    if difficulty in (1, 4):  # vecteur AB
        xa, ya, xb, yb = (rng.randint(-span, span) for _ in range(4))
        while (xa, ya) == (xb, yb):
            xb = rng.randint(-span, span)
        dx, dy = xb - xa, yb - ya
        correct = vec(dx, dy)
        distractors = [vec(-dx, -dy), vec(xa + xb, ya + yb), vec(dy, dx), vec(dx + 1, dy)]
        prompt = f"Dans un repère, {_point('A', xa, ya)} et {_point('B', xb, yb)}. Les coordonnées du vecteur AB sont :"
        explanation = f"AB a pour coordonnées (xB − xA ; yB − yA) = ({fr_number(xb)} − {p(xa)} ; {fr_number(yb)} − {p(ya)}) = {correct}."
        hint = "Coordonnées de AB : (xB − xA ; yB − yA). C'est « arrivée moins départ »."
        meta = {"case": "AB", "values": [xa, ya, xb, yb], "result": [dx, dy]}
    elif difficulty == 2:  # u + v
        ux, uy, vx, vy = (rng.randint(-span, span) for _ in range(4))
        correct = vec(ux + vx, uy + vy)
        distractors = [
            vec(ux - vx, uy - vy),
            vec(ux * vx, uy * vy),
            vec(ux + vy, uy + vx),
            vec(ux + vx, uy - vy),
        ]
        prompt = f"u{vec(ux, uy)} et v{vec(vx, vy)}. Les coordonnées de u + v sont :"
        explanation = f"On additionne coordonnée par coordonnée : ({fr_number(ux)} + {p(vx)} ; {fr_number(uy)} + {p(vy)}) = {correct}."
        hint = "On additionne les abscisses entre elles, et les ordonnées entre elles."
        meta = {"case": "sum", "result": [ux + vx, uy + vy]}
    elif difficulty == 3:  # k·u
        k = _nonzero(rng, -5, 5)
        ux, uy = rng.randint(-span, span), rng.randint(-span, span)
        correct = vec(k * ux, k * uy)
        distractors = [vec(k + ux, k + uy), vec(k * ux, uy), vec(-k * ux, -k * uy), vec(ux, k * uy)]
        prompt = f"u{vec(ux, uy)}. Les coordonnées de {fr_number(k)}u sont :"
        explanation = f"On multiplie chaque coordonnée par {fr_number(k)} : ({fr_number(k)} × {p(ux)} ; {fr_number(k)} × {p(uy)}) = {correct}."
        hint = "Chaque coordonnée est multipliée par le réel."
        meta = {"case": "scalar", "result": [k * ux, k * uy]}
    else:  # 2u − 3v
        ux, uy, vx, vy = (rng.randint(-6, 6) for _ in range(4))
        p_, q = rng.randint(2, 4), rng.randint(2, 4)
        rx, ry = p_ * ux - q * vx, p_ * uy - q * vy
        correct = vec(rx, ry)
        distractors = [
            vec(p_ * ux + q * vx, p_ * uy + q * vy),
            vec(p_ * ux - vx, p_ * uy - vy),
            vec(ux - vx, uy - vy),
            vec(rx, -ry),
        ]
        prompt = f"u{vec(ux, uy)} et v{vec(vx, vy)}. Les coordonnées de {p_}u − {q}v sont :"
        explanation = (
            f"({p_} × {p(ux)} − {q} × {p(vx)} ; {p_} × {p(uy)} − {q} × {p(vy)}) = {correct}."
        )
        hint = "Calcule d'abord les coordonnées de chaque vecteur multiplié, puis soustrais."
        meta = {"case": "combination", "result": [rx, ry]}
    return _mcq(prompt, correct, distractors, hint, explanation, difficulty, rng, meta)


# --- Colinéarité --------------------------------------------------------------------------


def _collinearity(difficulty: int, rng: random.Random) -> dict:
    span = 5 if difficulty <= 2 else 9
    ux, uy = _nonzero(rng, -span, span), _nonzero(rng, -span, span)
    if difficulty <= 3:  # calcul du déterminant
        vx, vy = rng.randint(-span, span), rng.randint(-span, span)
        det = ux * vy - uy * vx
        return {
            "type": "numeric",
            "prompt": f"u{vec(ux, uy)} et v{vec(vx, vy)}. Calcule le déterminant det(u, v).",
            "answer": {"kind": "number", "value": str(det)},
            "hint": "det(u, v) = x·y′ − y·x′ pour u(x ; y) et v(x′ ; y′).",
            "explanation": f"det(u, v) = {p(ux)} × {p(vy)} − {p(uy)} × {p(vx)} = {fr_number(det)}.",
            "time_target_ms": 20000 + 6000 * difficulty,
            "meta": {"u": [ux, uy], "v": [vx, vy], "det": det},
        }
    collinear = rng.random() < 0.5
    if collinear:
        k = Fraction(_nonzero(rng, -4, 4), rng.choice([1, 1, 2]))
        vx, vy = k * ux, k * uy
        if vx.denominator != 1 or vy.denominator != 1:
            ux, uy = 2 * ux, 2 * uy
            vx, vy = k * ux, k * uy
    else:
        vx, vy = Fraction(rng.randint(-span, span)), Fraction(rng.randint(-span, span))
        while ux * vy - uy * vx == 0:
            vy += 1
    det = ux * vy - uy * vx
    correct = "Oui" if det == 0 else "Non"
    explanation = f"det(u, v) = {p(ux)} × {p(vy)} − {p(uy)} × {p(vx)} = {fr_number(det)}. " + (
        "Il est nul : u et v sont colinéaires."
        if det == 0
        else "Il n'est pas nul : u et v ne sont pas colinéaires."
    )
    item = _mcq(
        f"u{vec(ux, uy)} et v{vec(vx, vy)} sont-ils colinéaires ?",
        correct,
        ["Non" if correct == "Oui" else "Oui"],
        "Deux vecteurs sont colinéaires si et seulement si leur déterminant est nul.",
        explanation,
        difficulty,
        rng,
        {"u": [ux, uy], "v": [str(vx), str(vy)], "det": str(det)},
    )
    return item


# --- Milieu et distance ----------------------------------------------------------------------


def _midpoint_distance(difficulty: int, rng: random.Random) -> dict:
    if difficulty <= 2:  # milieu
        xa, ya = rng.randint(-8, 8), rng.randint(-8, 8)
        xb, yb = rng.randint(-8, 8), rng.randint(-8, 8)
        if difficulty == 1:  # sommes paires : coordonnées entières
            xb += (xa + xb) % 2
            yb += (ya + yb) % 2
        mx, my = Fraction(xa + xb, 2), Fraction(ya + yb, 2)
        correct = vec(mx, my)
        distractors = [
            vec(xb - xa, yb - ya),
            vec(Fraction(xb - xa, 2), Fraction(yb - ya, 2)),
            vec(xa + xb, ya + yb),
            vec(my, mx),
        ]
        return _mcq(
            f"{_point('A', xa, ya)} et {_point('B', xb, yb)}. Les coordonnées du milieu I de [AB] sont :",
            correct,
            distractors,
            "Milieu : la moyenne des abscisses et la moyenne des ordonnées.",
            f"I = ((xA + xB)/2 ; (yA + yB)/2) = (({fr_number(xa)} + {p(xb)})/2 ; ({fr_number(ya)} + {p(yb)})/2) = {correct}.",
            difficulty,
            rng,
            {"case": "milieu", "a": [xa, ya], "b": [xb, yb]},
        )
    a, b, c = rng.choice(TRIPLES if difficulty == 5 else TRIPLES[:4])
    dx, dy = (a, b) if rng.random() < 0.5 else (b, a)
    dx *= rng.choice([-1, 1])
    dy *= rng.choice([-1, 1])
    xa, ya = rng.randint(-9, 9), rng.randint(-9, 9)
    xb, yb = xa + dx, ya + dy
    return {
        "type": "numeric",
        "prompt": f"Dans un repère orthonormé, {_point('A', xa, ya)} et {_point('B', xb, yb)}. Calcule la distance AB.",
        "answer": {"kind": "number", "value": str(c)},
        "hint": "AB = √((xB − xA)² + (yB − yA)²).",
        "explanation": f"AB = √(({fr_number(xb)} − {p(xa)})² + ({fr_number(yb)} − {p(ya)})²) = √({p(dx)}² + {p(dy)}²) = √{c * c} = {c}.",
        "time_target_ms": 30000 + 8000 * difficulty,
        "meta": {"case": "distance", "a": [xa, ya], "b": [xb, yb], "d": c},
    }


COORDINATES = register(
    Generator(
        code="2nde.vecteurs.coordonnees",
        level="2nde",
        notion="2nde.maths.vecteurs.coordonnees",
        role="chapitre",
        title="Coordonnées de vecteurs",
        generate=_coordinates,
    )
)

COLLINEARITY = register(
    Generator(
        code="2nde.vecteurs.colinearite",
        level="2nde",
        notion="2nde.maths.vecteurs.colinearite",
        role="chapitre",
        title="Colinéarité et déterminant",
        generate=_collinearity,
    )
)

MIDPOINT_DISTANCE = register(
    Generator(
        code="2nde.geometrie.milieu_distance",
        level="2nde",
        notion="2nde.maths.geometrie_reperee.milieu_distance",
        role="chapitre",
        title="Milieu et distance",
        generate=_midpoint_distance,
    )
)
