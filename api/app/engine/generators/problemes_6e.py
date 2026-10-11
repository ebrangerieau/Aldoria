"""Problèmes, grandeurs et géométrie, 6ème (programme cycle 3, arrêté du 10 avril 2025) :
fraction d'une quantité, encadrer une fraction, schéma en barres, suites de motifs,
durées, aire du rectangle, angle manquant d'un triangle, proportionnalité (retour à
l'unité), échelles, probabilités en situation d'équiprobabilité.

Les contextes sont ceux du monde d'Aldoria (potions, pièces d'or, carte du royaume).
"""

from __future__ import annotations

import random
from decimal import Decimal
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.formatting import frac_latex, frac_text, sentence
from app.engine.generators.nombres_6e import dec, plain


def _numeric(prompt, answer, hint, explanation, target_ms, meta, kind="number", latex=None) -> dict:
    item = {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": kind, "value": answer},
        "hint": hint,
        "explanation": sentence(explanation),
        "time_target_ms": target_ms,
        "meta": meta,
    }
    if kind == "fraction":
        item["answer"]["accept_equivalent"] = True
    if latex:
        item["latex"] = latex
    return item


def _mcq(prompt, correct, distractors, hint, explanation, target_ms, rng, meta) -> dict:
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
        "explanation": sentence(explanation),
        "time_target_ms": target_ms,
        "meta": meta,
    }


# --- Fraction d'une quantité ----------------------------------------------------------

_THINGS = [
    ("pièces d'or", "Le trésor compte"),
    ("potions", "L'apothicaire a"),
    ("flèches", "Le carquois contient"),
]


def _quantity(difficulty: int, rng: random.Random) -> dict:
    d = rng.choice({1: [2, 4, 10], 2: [3, 5, 2, 4]}.get(difficulty, [3, 4, 5, 6, 8, 10]))
    n = 1 if difficulty <= 2 else rng.randint(min(2, d - 1), d - 1)
    part = rng.randint(2, 12 if difficulty <= 3 else 25)
    total = d * part
    result = n * part
    things, intro = rng.choice(_THINGS)
    prompt = f"{intro} {total} {things}. Combien font les {n}/{d} de ces {things} ?"
    if n == 1:
        explanation = f"{total} ÷ {d} = {result}"
    else:
        explanation = f"On partage en {d} : {total} ÷ {d} = {part}, puis on prend {n} parts : {n} × {part} = {result}"
    return _numeric(
        prompt,
        str(result),
        f"Partage d'abord {total} en {d} parts égales, puis prends-en {n}.",
        explanation,
        20000 + 7000 * difficulty,
        {"n": n, "d": d, "total": total, "result": result},
    )


# --- Encadrer une fraction entre deux entiers -------------------------------------------


def _bracket(difficulty: int, rng: random.Random) -> dict:
    d = rng.randint(2, 6 if difficulty <= 2 else 12)
    k = rng.randint(0 if difficulty == 1 else 1, 3 if difficulty <= 3 else 9)
    n = k * d + rng.randint(1, d - 1)  # jamais entier : k < n/d < k + 1
    correct = f"{k} et {k + 1}"
    distractors = [
        f"{k + 1} et {k + 2}",
        f"{k - 1} et {k}" if k else f"{k + 2} et {k + 3}",
        f"{k} et {k + 2}",
    ]
    if difficulty >= 4:
        # Nombre mixte : n/d = k + r/d.
        r = n - k * d
        return _numeric(
            f"Écris {n}/{d} sous la forme d'un entier plus une fraction inférieure à 1 : "
            f"{n}/{d} = … + {r}/{d}. Quel est l'entier ?",
            str(k),
            f"Combien de fois {d} dans {n} ? Le reste donne la fraction.",
            f"{n} = {d} × {k} + {r}, donc {n}/{d} = {k} + {r}/{d}",
            25000 + 6000 * difficulty,
            {"n": n, "d": d, "k": k},
            latex=frac_latex(n, d),
        )
    return _mcq(
        f"Entre quels entiers consécutifs se trouve {n}/{d} ?",
        correct,
        distractors,
        f"Cherche le multiple de {d} juste en dessous de {n}.",
        f"{d} × {k} = {k * d} et {d} × {k + 1} = {(k + 1) * d} ; comme {k * d} < {n} < {(k + 1) * d}, "
        f"on a {k} < {n}/{d} < {k + 1}",
        20000 + 6000 * difficulty,
        rng,
        {"n": n, "d": d, "k": k},
    )


# --- Schéma en barres -------------------------------------------------------------------------


def _bars(difficulty: int, rng: random.Random) -> dict:
    """Problèmes « à trou » que l'on résout en dessinant des barres (programme 2025)."""
    a = rng.randint(8, 40 if difficulty <= 2 else 120)
    if difficulty == 1:  # tout = partie + partie
        b = rng.randint(5, 40)
        return _numeric(
            f"Lina a {a} pièces d'or. Après la quête, elle en a {a + b}. Combien en a-t-elle gagné ?",
            str(b),
            "Dessine une grande barre (le total) et une barre plus courte (ce qu'elle avait) : la différence est ce qu'elle a gagné.",
            f"{a + b} − {a} = {b}",
            30000,
            {"result": b},
        )
    if difficulty == 2:  # comparaison : « … de plus que »
        b = rng.randint(3, 30)
        return _numeric(
            f"Le dragon a {a + b} écailles dorées, c'est {b} de plus que le griffon. Combien d'écailles le griffon a-t-il ?",
            str(a),
            "Le dragon a la barre la plus longue : enlève la différence pour trouver la barre du griffon.",
            f"{a + b} − {b} = {a}",
            35000,
            {"result": a},
        )
    if difficulty == 3:  # fois plus
        k = rng.randint(2, 6)
        part = rng.randint(4, 25)
        return _numeric(
            f"La tour mesure {k * part} m. C'est {k} fois la hauteur de la maison. Quelle est la hauteur de la maison ?",
            str(part),
            f"Dessine la tour comme {k} barres de la même taille que la maison.",
            f"{k * part} ÷ {k} = {part}",
            40000,
            {"result": part},
        )
    # Niveaux 4 et 5 : partage inégal (somme et écart, ou somme et rapport).
    if difficulty == 4:
        small = rng.randint(5, 50)
        gap = rng.randint(2, 30)
        total = 2 * small + gap
        return _numeric(
            f"Tom et Jules ont ensemble {total} cristaux. Tom en a {gap} de plus que Jules. Combien Jules en a-t-il ?",
            str(small),
            "Enlève d'abord l'écart : il reste deux barres égales.",
            f"{total} − {gap} = {total - gap}, puis {total - gap} ÷ 2 = {small}",
            50000,
            {"result": small},
        )
    k = rng.randint(2, 4)
    unit = rng.randint(3, 30)
    total = (k + 1) * unit
    return _numeric(
        f"Un sac et un coffre contiennent ensemble {total} pièces. Le coffre en contient {k} fois plus que le sac. "
        "Combien de pièces y a-t-il dans le sac ?",
        str(unit),
        f"Le sac fait une barre, le coffre {k} barres : {k + 1} barres en tout.",
        f"{k + 1} barres valent {total}, donc une barre vaut {total} ÷ {k + 1} = {unit}",
        55000,
        {"result": unit},
    )


# --- Suites de motifs -------------------------------------------------------------------------


def _patterns(difficulty: int, rng: random.Random) -> dict:
    start = rng.randint(2, 6)
    step = rng.randint(2, 4 if difficulty <= 2 else 7)
    terms = [start + step * i for i in range(4)]
    seq = ", ".join(str(t) for t in terms)
    if difficulty <= 2:  # terme suivant
        return _numeric(
            f"Au rang 1, le motif compte {terms[0]} tuiles ; puis {terms[1]}, {terms[2]}, {terms[3]}. "
            "Combien de tuiles au rang 5 ?",
            str(start + 4 * step),
            "Regarde de combien le nombre de tuiles augmente d'un rang au suivant.",
            f"On ajoute {step} tuiles à chaque rang : {terms[3]} + {step} = {start + 4 * step}",
            25000 + 5000 * difficulty,
            {"start": start, "step": step, "rank": 5},
        )
    rank = rng.randint(8, 12) if difficulty == 3 else rng.randint(15, 50)
    value = start + step * (rank - 1)
    if difficulty == 5:  # rang d'un nombre de tuiles donné
        return _numeric(
            f"Les motifs comptent {seq}… tuiles (rangs 1, 2, 3, 4…). À quel rang le motif compte-t-il {value} tuiles ?",
            str(rank),
            f"Au rang n, il y a {start} + {step} × (n − 1) tuiles.",
            f"{value} − {start} = {value - start} ; {value - start} ÷ {step} = {rank - 1} ajouts, donc rang {rank}",
            60000,
            {"start": start, "step": step, "rank": rank, "value": value},
        )
    return _numeric(
        f"Les motifs comptent {seq}… tuiles (rangs 1, 2, 3, 4…). Combien de tuiles au rang {rank} ?",
        str(value),
        f"Du rang 1 au rang {rank}, on ajoute {rank - 1} fois {step} tuiles.",
        f"{start} + {step} × {rank - 1} = {value}",
        40000 + 5000 * difficulty,
        {"start": start, "step": step, "rank": rank, "value": value},
    )


# --- Durées -----------------------------------------------------------------------------------


def _hm(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h} h {m:02d}" if m else f"{h} h"


def _durations(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # convertir des heures et minutes en minutes
        h, m = rng.randint(1, 3), rng.choice([10, 15, 20, 30, 45])
        return _numeric(
            f"Combien de minutes dans {h} h {m:02d} min ?",
            str(60 * h + m),
            "Une heure, c'est 60 minutes.",
            f"{h} × 60 + {m} = {60 * h + m} minutes",
            20000,
            {"result": 60 * h + m},
        )
    start = rng.randint(8 * 4, 16 * 4) * 15 if difficulty <= 3 else rng.randint(8 * 60, 17 * 60)
    duration = (
        rng.choice([25, 40, 45, 50, 75, 90, 105]) if difficulty <= 3 else rng.randint(35, 200)
    )
    end = start + duration
    if difficulty in (2, 4):  # durée entre deux horaires, en minutes
        return _numeric(
            f"La quête commence à {_hm(start)} et se termine à {_hm(end)}. Combien de minutes a-t-elle duré ?",
            str(duration),
            "Compte d'abord jusqu'à l'heure pile suivante, puis ajoute le reste.",
            f"De {_hm(start)} à {_hm(end)}, il s'écoule {duration} minutes",
            30000 + 6000 * difficulty,
            {"start": start, "end": end, "result": duration},
        )
    # Niveaux 3 et 5 : heure de fin (réponse en minutes après l'heure pleine demandée).
    h, m = divmod(end, 60)
    return _numeric(
        f"Le voyage commence à {_hm(start)} et dure {duration} min. Il se termine à {h} h et combien de minutes ?",
        str(m),
        "Ajoute les minutes, et passe à l'heure suivante quand tu atteins 60.",
        f"{_hm(start)} + {duration} min = {_hm(end)}",
        30000 + 6000 * difficulty,
        {"start": start, "duration": duration, "end_minutes": m, "end_hour": h},
    )


# --- Aire du rectangle -------------------------------------------------------------------------


def _area(difficulty: int, rng: random.Random) -> dict:
    a, b = rng.randint(2, 9 if difficulty <= 2 else 15), rng.randint(2, 12)
    if difficulty == 5:  # côté manquant
        return _numeric(
            f"Un champ rectangulaire a une aire de {a * b} m² et une largeur de {b} m. Quelle est sa longueur (en m) ?",
            str(a),
            "Aire = longueur × largeur : cherche le nombre qui, multiplié par la largeur, donne l'aire.",
            f"{a * b} ÷ {b} = {a} m",
            40000,
            {"a": a, "b": b},
        )
    if difficulty >= 3:  # aire d'un carré ou unités différentes
        if difficulty == 3:
            return _numeric(
                f"Quelle est l'aire (en cm²) d'un carré de {a} cm de côté ?",
                str(a * a),
                "L'aire d'un carré : côté × côté.",
                f"{a} × {a} = {a * a} cm²",
                25000,
                {"a": a, "b": a},
            )
        meters = rng.randint(1, 3)
        return _numeric(
            f"Un tapis mesure {meters} m sur {b * 10} cm. Quelle est son aire en cm² ?",
            str(meters * 100 * b * 10),
            "Mets d'abord les deux longueurs dans la même unité : 1 m = 100 cm.",
            f"{meters} m = {meters * 100} cm ; {meters * 100} × {b * 10} = {meters * 100 * b * 10} cm²",
            50000,
            {"a": meters * 100, "b": b * 10},
        )
    return _numeric(
        f"Quelle est l'aire (en cm²) d'un rectangle de {a} cm sur {b} cm ?",
        str(a * b),
        "L'aire d'un rectangle : longueur × largeur.",
        f"{a} × {b} = {a * b} cm²",
        20000 + 5000 * difficulty,
        {"a": a, "b": b},
    )


# --- Angle manquant d'un triangle ------------------------------------------------------------


def _triangle(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # triangle rectangle
        a = rng.randint(15, 75)
        b, c = 90, 180 - 90 - a
        prompt = (
            f"Un triangle a un angle droit et un angle de {a}°. Combien mesure le troisième angle ?"
        )
    elif difficulty == 2:  # isocèle : angle au sommet donné
        top = rng.randrange(20, 160, 10 if rng.random() < 0.5 else 4)
        if (180 - top) % 2:
            top += 1
        a, b, c = top, (180 - top) // 2, (180 - top) // 2
        prompt = f"Un triangle isocèle a un angle au sommet de {top}°. Combien mesure chacun des deux autres angles ?"
        return _numeric(
            prompt,
            str(c),
            "Dans un triangle isocèle, les deux angles à la base sont égaux, et la somme des trois angles vaut 180°.",
            f"180 − {top} = {180 - top}, partagé en deux : {c}°",
            35000,
            {"angles": [a, b, c]},
        )
    elif difficulty == 5:  # équilatéral ou isocèle : angle à la base donné
        base = rng.randint(20, 80)
        a, b, c = base, base, 180 - 2 * base
        prompt = f"Un triangle isocèle a deux angles à la base de {base}°. Combien mesure l'angle au sommet ?"
    else:
        a = rng.randint(20, 110)
        b = rng.randint(15, 160 - a)
        c = 180 - a - b
        prompt = f"Un triangle a deux angles de {a}° et {b}°. Combien mesure le troisième ?"
    return _numeric(
        prompt,
        str(c),
        "La somme des trois angles d'un triangle vaut toujours 180°.",
        f"180 − {a} − {b} = {c}°",
        25000 + 5000 * difficulty,
        {"angles": [a, b, c]},
    )


# --- Proportionnalité : retour à l'unité -------------------------------------------------------


def _unit_rate(difficulty: int, rng: random.Random) -> dict:
    n = rng.randint(2, 6 if difficulty <= 2 else 9)
    unit_price = rng.randint(2, 12) if difficulty <= 3 else Decimal(rng.randint(15, 95)) / 10
    m = rng.randint(2, 12)
    while m == n:
        m = rng.randint(2, 12)
    total_n = unit_price * n
    total_m = unit_price * m
    item, shop = rng.choice(
        [("potions", "L'apothicaire"), ("parchemins", "Le libraire"), ("pommes", "Le marchand")]
    )
    return _numeric(
        f"{shop} vend {n} {item} pour {dec(total_n)} pièces. Combien coûtent {m} {item} ?",
        plain(total_m),
        f"Cherche d'abord le prix d'une seule : {dec(total_n)} ÷ {n}.",
        f"Une coûte {dec(total_n)} ÷ {n} = {dec(unit_price)} pièces, donc {m} coûtent {m} × {dec(unit_price)} = {dec(total_m)}",
        30000 + 8000 * difficulty,
        {"n": n, "m": m, "unit": str(unit_price), "result": str(total_m)},
    )


# --- Échelles --------------------------------------------------------------------------------


def _scales(difficulty: int, rng: random.Random) -> dict:
    scale = rng.choice(
        {1: [100, 1000], 2: [1000, 10000]}.get(difficulty, [10000, 25000, 50000, 100000])
    )
    cm = rng.randint(2, 12)
    real_cm = cm * scale
    if difficulty <= 2:
        return _numeric(
            f"Sur la carte d'Aldoria, à l'échelle 1/{dec(scale)}, deux villages sont à {cm} cm. "
            "Quelle est la distance réelle, en cm ?",
            str(real_cm),
            f"Échelle 1/{dec(scale)} : 1 cm sur la carte représente {dec(scale)} cm en vrai.",
            f"{cm} × {dec(scale)} = {dec(real_cm)} cm",
            30000 + 5000 * difficulty,
            {"scale": scale, "cm": cm, "result": real_cm},
        )
    km = Decimal(real_cm) / 100000
    if difficulty == 5:  # distance sur la carte
        return _numeric(
            f"Deux tours sont à {dec(km)} km l'une de l'autre. À l'échelle 1/{dec(scale)}, "
            "à combien de centimètres sont-elles sur la carte ?",
            str(cm),
            f"Convertis {dec(km)} km en cm (1 km = 100 000 cm), puis divise par {dec(scale)}.",
            f"{dec(km)} km = {dec(real_cm)} cm ; {dec(real_cm)} ÷ {dec(scale)} = {cm} cm",
            60000,
            {"scale": scale, "cm": cm, "km": str(km)},
        )
    return _numeric(
        f"À l'échelle 1/{dec(scale)}, une route mesure {cm} cm sur la carte. Quelle est sa longueur réelle en km ?",
        plain(km),
        "Calcule la longueur réelle en cm, puis convertis : 1 km = 100 000 cm.",
        f"{cm} × {dec(scale)} = {dec(real_cm)} cm = {dec(km)} km",
        45000 + 5000 * difficulty,
        {"scale": scale, "cm": cm, "km": str(km)},
    )


# --- Probabilités (équiprobabilité) -----------------------------------------------------------


def _probability(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # dé à 6 faces
        target = rng.choice(["un 6", "un nombre pair", "un nombre supérieur à 4", "un 1 ou un 2"])
        favorable = {
            "un 6": 1,
            "un nombre pair": 3,
            "un nombre supérieur à 4": 2,
            "un 1 ou un 2": 2,
        }[target]
        p = Fraction(favorable, 6)
        return _numeric(
            f"On lance un dé à 6 faces équilibré. Quelle est la probabilité d'obtenir {target} ? "
            "(réponds par une fraction)",
            frac_text(p),
            "Probabilité = nombre de cas favorables ÷ nombre de cas possibles.",
            f"{favorable} cas favorables sur 6 : {favorable}/6"
            + (f" = {frac_text(p)}" if p.denominator != 6 else ""),
            30000,
            {"favorable": favorable, "total": 6},
            kind="fraction",
        )
    colors = rng.sample(["rouges", "bleues", "vertes", "jaunes"], 3)
    counts = [rng.randint(1, 4 + 2 * difficulty) for _ in colors]
    total = sum(counts)
    i = rng.randrange(3)
    if difficulty >= 4:  # « pas » d'une couleur
        favorable = total - counts[i]
        question = f"de ne pas tirer une bille {colors[i][:-1]}"
    else:
        favorable = counts[i]
        question = f"de tirer une bille {colors[i][:-1]}"
    p = Fraction(favorable, total)
    content = ", ".join(f"{c} billes {col}" for c, col in zip(counts, colors, strict=True))
    if difficulty == 5:
        return _mcq(
            f"Un sac contient {content}. On tire une bille au hasard. Quelle est la probabilité {question} ?",
            f"{favorable}/{total}",
            [
                f"{counts[i]}/{total}",
                f"{favorable}/{counts[i]}",
                f"1/{total}",
                f"{total - favorable}/{total}",
            ],
            "Compte toutes les billes, puis celles qui conviennent.",
            f"{favorable} billes conviennent sur {total} : {favorable}/{total}",
            40000,
            rng,
            {"counts": counts, "favorable": favorable, "total": total},
        )
    return _numeric(
        f"Un sac contient {content}. On tire une bille au hasard. Quelle est la probabilité {question} ? "
        "(réponds par une fraction)",
        frac_text(p),
        "Probabilité = nombre de billes qui conviennent ÷ nombre total de billes.",
        f"{favorable} billes conviennent sur {total} : {favorable}/{total}"
        + (f" = {frac_text(p)}" if p.denominator != total else ""),
        30000 + 6000 * difficulty,
        {"counts": counts, "favorable": favorable, "total": total},
        kind="fraction",
    )


def _gen(code, notion, title, fn) -> Generator:
    return register(
        Generator(code=code, level="6e", notion=notion, role="chapitre", title=title, generate=fn)
    )


QUANTITY = _gen(
    "6e.fractions.quantite", "6e.maths.fractions.quantite", "Fraction d'une quantité", _quantity
)
BRACKET = _gen(
    "6e.fractions.encadrement", "6e.maths.fractions.encadrement", "Encadrer une fraction", _bracket
)
BARS = _gen(
    "6e.prealgebre.schema_barres", "6e.maths.prealgebre.schema_barres", "Schéma en barres", _bars
)
PATTERNS = _gen(
    "6e.prealgebre.suites_motifs",
    "6e.maths.prealgebre.suites_motifs",
    "Suites de motifs",
    _patterns,
)
DURATIONS = _gen("6e.grandeurs.durees", "6e.maths.grandeurs.durees", "Durées", _durations)
AREA = _gen(
    "6e.grandeurs.aire_rectangle", "6e.maths.grandeurs.aire_rectangle", "Aire du rectangle", _area
)
TRIANGLE = _gen(
    "6e.angles.somme_triangle",
    "6e.maths.angles.somme_triangle",
    "Angle manquant d'un triangle",
    _triangle,
)
UNIT_RATE = _gen(
    "6e.proportionnalite.retour_unite",
    "6e.maths.proportionnalite.retour_unite",
    "Retour à l'unité",
    _unit_rate,
)
SCALES = _gen(
    "6e.proportionnalite.echelles", "6e.maths.proportionnalite.echelles", "Échelles", _scales
)
PROBABILITY = _gen(
    "6e.probabilites.equiprobabilite",
    "6e.maths.probabilites.equiprobabilite",
    "Probabilités",
    _probability,
)
