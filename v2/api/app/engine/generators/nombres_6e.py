"""Nombres et automatismes, 6ème (programme cycle 3, arrêté du 10 avril 2025) :
tables de multiplication, calcul mental, conversions, multiplier et diviser par
10, 100, 1 000, comparer des décimaux, division euclidienne.

Les décimaux sont écrits à la française (virgule) dans l'énoncé comme dans la
réponse attendue ; le validateur accepte aussi le point.
"""

from __future__ import annotations

import random
from decimal import Decimal

from app.engine.generators import Generator, register
from app.engine.generators.formatting import sentence


def dec(value: Decimal | int) -> str:
    """Décimal exact à la française : 12,5 ; 0,03 ; 1 200 (espace des milliers)."""
    text = format(Decimal(value).normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    whole, _, frac = text.partition(".")
    sign = "−" if whole.startswith("-") else ""
    whole = whole.lstrip("-")
    groups = []
    while len(whole) > 3:
        groups.insert(0, whole[-3:])
        whole = whole[:-3]
    groups.insert(0, whole)
    out = " ".join(groups)
    return sign + out + ("," + frac if frac else "")


def plain(value: Decimal | int) -> str:
    """Même nombre, sans espace des milliers (valeur de réponse attendue)."""
    return dec(value).replace(" ", "")


def _numeric(prompt, answer, hint, explanation, target_ms, meta) -> dict:
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": "number", "value": answer},
        "hint": hint,
        "explanation": sentence(explanation),
        "time_target_ms": target_ms,
        "meta": meta,
    }


# --- Tables de multiplication (automatisme) ---------------------------------------


def _tables(difficulty: int, rng: random.Random) -> dict:
    tables = {1: [2, 3, 4, 5, 10], 2: [6, 7, 8, 9], 3: list(range(2, 10))}.get(
        difficulty, list(range(3, 10))
    )
    a, b = rng.choice(tables), rng.randint(2, 9)
    if rng.random() < 0.5:
        a, b = b, a
    product = a * b
    if difficulty <= 3:
        return _numeric(
            f"Combien font {a} × {b} ?",
            str(product),
            f"Récite la table de {max(a, b)}.",
            f"{a} × {b} = {product}",
            8000 + 2000 * difficulty,
            {"a": a, "b": b, "case": "produit"},
        )
    # Niveaux 4 et 5 : facteur manquant (la division, c'est la table à l'envers).
    if difficulty == 4:
        prompt = f"{a} × … = {product}. Quel est le nombre manquant ?"
    else:
        prompt = f"Combien de fois {a} dans {product} ?"
    return _numeric(
        prompt,
        str(b),
        f"Cherche dans la table de {a} le nombre qui donne {product}.",
        f"{a} × {b} = {product}, donc le nombre cherché est {b}",
        10000 + 2000 * difficulty,
        {"a": a, "b": b, "case": "facteur"},
    )


# --- Calcul mental (automatisme) -----------------------------------------------------


def _mental(difficulty: int, rng: random.Random) -> dict:
    if difficulty == 1:  # complément à 10, 100
        target = rng.choice([10, 100])
        a = rng.randint(1, target - 1) if target == 10 else rng.randrange(5, 100, 5)
        return _numeric(
            f"Combien faut-il ajouter à {a} pour obtenir {target} ?",
            str(target - a),
            f"Compte de {a} jusqu'à {target}.",
            f"{a} + {target - a} = {target}",
            12000,
            {"case": "complement", "a": a, "target": target, "result": target - a},
        )
    if difficulty == 2:  # addition ou soustraction de deux nombres à 2 chiffres
        a, b = rng.randint(21, 89), rng.randint(11, 59)
        if rng.random() < 0.5 and a > b:
            result, op = a - b, "−"
            hint = f"Enlève d'abord les dizaines de {b}, puis les unités."
        else:
            result, op = a + b, "+"
            hint = f"Ajoute d'abord les dizaines de {b}, puis les unités."
        return _numeric(
            f"Calcule {a} {op} {b}.",
            str(result),
            hint,
            f"{a} {op} {b} = {result}",
            15000,
            {"case": "addsub", "a": a, "b": b, "op": op, "result": result},
        )
    if difficulty == 3:  # multiplier par 5, 25, 50 ou 11
        k = rng.choice([5, 25, 50, 11])
        a = (
            rng.choice([4, 6, 8, 12, 14, 16, 18, 22, 24, 32, 36, 44])
            if k != 11
            else rng.randint(12, 45)
        )
        tricks = {
            5: "Multiplier par 5, c'est multiplier par 10 puis diviser par 2.",
            25: "Multiplier par 25, c'est multiplier par 100 puis diviser par 4.",
            50: "Multiplier par 50, c'est multiplier par 100 puis diviser par 2.",
            11: "Multiplier par 11, c'est multiplier par 10 puis ajouter le nombre.",
        }
        return _numeric(
            f"Calcule {a} × {k}.",
            str(a * k),
            tricks[k],
            f"{tricks[k]} {a} × {k} = {a * k}",
            18000,
            {"case": "astuce", "a": a, "k": k, "result": a * k},
        )
    # Niveaux 4 et 5 : décimaux (somme ou différence à un chiffre après la virgule ou deux).
    places = 1 if difficulty == 4 else 2
    step = Decimal(1).scaleb(-places)
    a = Decimal(rng.randint(10, 200)) * step
    b = Decimal(rng.randint(5, 150)) * step
    if rng.random() < 0.5 and a > b:
        result, op = a - b, "−"
    else:
        result, op = a + b, "+"
    return _numeric(
        f"Calcule {dec(a)} {op} {dec(b)}.",
        plain(result),
        "Aligne les virgules dans ta tête : les dixièmes avec les dixièmes, les centièmes avec les centièmes.",
        f"{dec(a)} {op} {dec(b)} = {dec(result)}",
        20000 + 4000 * difficulty,
        {"case": "decimaux", "a": str(a), "b": str(b), "op": op, "result": str(result)},
    )


# --- Conversions (automatisme) ----------------------------------------------------------

_UNITS = {
    "longueur": (["km", "hm", "dam", "m", "dm", "cm", "mm"], "m"),
    "masse": (["kg", "hg", "dag", "g", "dg", "cg", "mg"], "g"),
    "contenance": (["kL", "hL", "daL", "L", "dL", "cL", "mL"], "L"),
}


def _conversions(difficulty: int, rng: random.Random) -> dict:
    kind = rng.choice(list(_UNITS))
    units, _ = _UNITS[kind]
    # Écart entre les unités : 1 rang au niveau 1, jusqu'à 3 rangs ; décimaux dès le niveau 3.
    gap = min(3, 1 + difficulty // 2)
    common = [
        u
        for u in units
        if u in ("km", "m", "cm", "mm", "kg", "g", "mg", "L", "cL", "mL", "dL", "hL")
    ]
    while True:
        src = rng.choice(common if difficulty <= 2 else units)
        i = units.index(src)
        j = i + rng.choice([-gap, gap, rng.randint(-gap, gap)])
        if 0 <= j < len(units) and j != i:
            break
    dst = units[j]
    if difficulty <= 2:
        value = Decimal(rng.randint(2, 60))
    else:
        value = Decimal(rng.randint(12, 950)).scaleb(-rng.randint(1, 2))
    result = value * Decimal(10) ** (j - i)  # vers une unité plus petite : on multiplie
    direction = "plus petite" if j > i else "plus grande"
    factor = 10 ** abs(j - i)
    op = "×" if j > i else "÷"
    return _numeric(
        f"Convertis : {dec(value)} {src} = … {dst}",
        plain(result),
        f"Le {dst} est une unité {direction} que le {src} : on {'multiplie' if j > i else 'divise'} par {dec(factor)}.",
        f"De {src} à {dst}, {abs(j - i)} rang{'s' if abs(j - i) > 1 else ''} dans le tableau de conversion : "
        f"{dec(value)} {op} {dec(factor)} = {dec(result)}, donc {dec(value)} {src} = {dec(result)} {dst}",
        15000 + 5000 * difficulty,
        {"value": str(value), "src": src, "dst": dst, "kind": kind, "result": str(result)},
    )


# --- Multiplier et diviser par 10, 100, 1 000 ----------------------------------------


def _times_ten(difficulty: int, rng: random.Random) -> dict:
    k = rng.choice([10, 100, 1000])
    if difficulty <= 2:
        value = (
            Decimal(rng.randint(3, 999))
            if difficulty == 1
            else Decimal(rng.randint(12, 999)).scaleb(-1)
        )
    else:
        value = Decimal(rng.randint(1, 9999)).scaleb(-rng.randint(1, 3))
    divide = difficulty in (2, 4) or (difficulty == 5 and rng.random() < 0.5)
    if difficulty == 1:
        divide = False
    result = value / k if divide else value * k
    op = "÷" if divide else "×"
    zeros = len(str(k)) - 1
    move = "gauche" if divide else "droite"
    return _numeric(
        f"Calcule {dec(value)} {op} {dec(k)}.",
        plain(result),
        f"{'Diviser' if divide else 'Multiplier'} par {dec(k)} : chaque chiffre prend une valeur "
        f"{zeros} rang{'s' if zeros > 1 else ''} plus {'petite' if divide else 'grande'} "
        f"(la virgule se déplace de {zeros} rang{'s' if zeros > 1 else ''} vers la {move}).",
        f"{dec(value)} {op} {dec(k)} = {dec(result)}",
        15000 + 4000 * difficulty,
        {"value": str(value), "k": k, "divide": divide, "result": str(result)},
    )


# --- Comparer et ranger des décimaux ---------------------------------------------------


def _compare_decimals(difficulty: int, rng: random.Random) -> dict:
    """QCM : le plus grand (ou le plus petit) de quatre décimaux. Les pièges classiques :
    la partie décimale « plus longue » n'est pas plus grande (2,9 > 2,15)."""
    whole = rng.randint(0, 20)
    if difficulty == 1:
        values = {Decimal(whole) + Decimal(d) / 10 for d in rng.sample(range(10), 4)}
    elif difficulty == 2:  # même partie entière, nombres de chiffres différents
        values = {
            Decimal(whole) + Decimal(rng.randint(1, 9)) / 10,
            Decimal(whole) + Decimal(rng.randint(10, 99)) / 100,
            Decimal(whole) + Decimal(rng.randint(10, 99)) / 100,
            Decimal(whole) + Decimal(rng.randint(100, 999)) / 1000,
        }
    else:  # parties entières proches, jusqu'aux millièmes
        values = {
            Decimal(rng.randint(max(0, whole - 1), whole + 1)) + Decimal(rng.randint(1, 999)) / 1000
            for _ in range(4)
        }
        values.add(Decimal(whole) + Decimal(rng.randint(1, 9)) / 10)
    while len(values) < 4:
        values.add(Decimal(whole) + Decimal(rng.randint(1, 99)) / 100)
    values = sorted(values)[:4] if difficulty < 3 else rng.sample(sorted(values), 4)
    smallest = difficulty >= 4 and rng.random() < 0.5
    target = min(values) if smallest else max(values)
    choices = [dec(v) for v in values]
    rng.shuffle(choices)
    ordered = " < ".join(dec(v) for v in sorted(values))
    return {
        "type": "mcq",
        "prompt": f"Quel est le plus {'petit' if smallest else 'grand'} de ces nombres ?",
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(dec(target))},
        "hint": "Compare d'abord les parties entières, puis les dixièmes, puis les centièmes… "
        "Tu peux ajouter des zéros à la fin pour avoir autant de chiffres : 2,9 = 2,90.",
        "explanation": f"Dans l'ordre croissant : {ordered}.",
        "time_target_ms": 15000 + 5000 * difficulty,
        "meta": {"values": [str(v) for v in values], "smallest": smallest},
    }


# --- Division euclidienne ------------------------------------------------------------------


def _euclid(difficulty: int, rng: random.Random) -> dict:
    divisor = rng.randint(2, 9)  # division par un nombre à un chiffre (programme 2025)
    quotient = rng.randint(2, 9 if difficulty == 1 else (30 if difficulty <= 3 else 150))
    remainder = rng.randint(0 if difficulty > 1 else 1, divisor - 1)
    dividend = divisor * quotient + remainder
    ask_remainder = difficulty in (2, 4) or (difficulty == 5 and rng.random() < 0.5)
    if difficulty == 5:
        # Problème : des objets rangés par paquets.
        items, groups, full = rng.choice(
            [
                ("billes", "sachets", "sachets pleins"),
                ("élèves", "équipes", "équipes complètes"),
                ("œufs", "boîtes", "boîtes pleines"),
            ]
        )
        de = "d'" if items[0] in "aeéiouœ" else "de "
        intro = f"On range {dividend} {items} dans des {groups} de {divisor}."
        if ask_remainder:
            prompt = f"{intro} Combien {de}{items} reste-t-il ?"
        else:
            prompt = (
                f"{intro} Combien de {full} obtient-on ?"
                if full[0] not in "aeéiou"
                else (f"{intro} Combien d'{full} obtient-on ?")
            )
    else:
        what = "le reste" if ask_remainder else "le quotient"
        prompt = f"Division euclidienne de {dividend} par {divisor} : quel est {what} ?"
    return _numeric(
        prompt,
        str(remainder if ask_remainder else quotient),
        f"Cherche le plus grand multiple de {divisor} qui ne dépasse pas {dividend}.",
        f"{dividend} = {divisor} × {quotient} + {remainder}, avec {remainder} < {divisor} : "
        f"le quotient est {quotient} et le reste {remainder}",
        20000 + 6000 * difficulty,
        {
            "dividend": dividend,
            "divisor": divisor,
            "quotient": quotient,
            "remainder": remainder,
            "ask_remainder": ask_remainder,
        },
    )


def _gen(code, notion, role, title, fn) -> Generator:
    return register(
        Generator(code=code, level="6e", notion=notion, role=role, title=title, generate=fn)
    )


TABLES = _gen(
    "6e.automatismes.tables",
    "6e.maths.automatismes.tables",
    "automatisme",
    "Tables de multiplication",
    _tables,
)
MENTAL = _gen(
    "6e.automatismes.calcul_mental",
    "6e.maths.automatismes.calcul_mental",
    "automatisme",
    "Calcul mental",
    _mental,
)
CONVERSIONS = _gen(
    "6e.automatismes.conversions",
    "6e.maths.automatismes.conversions",
    "automatisme",
    "Conversions d'unités",
    _conversions,
)
TIMES_TEN = _gen(
    "6e.nombres.multiplier_diviser_10",
    "6e.maths.nombres.multiplier_diviser_10",
    "chapitre",
    "×, ÷ par 10, 100, 1 000",
    _times_ten,
)
COMPARE_DECIMALS = _gen(
    "6e.nombres.comparer_decimaux",
    "6e.maths.nombres.comparer_decimaux",
    "chapitre",
    "Comparer des décimaux",
    _compare_decimals,
)
EUCLID = _gen(
    "6e.nombres.division_euclidienne",
    "6e.maths.nombres.division_euclidienne",
    "chapitre",
    "Division euclidienne",
    _euclid,
)
