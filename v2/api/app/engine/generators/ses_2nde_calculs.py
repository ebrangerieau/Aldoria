"""SES, seconde : générateurs calculés (savoir-faire quantitatifs du programme).

- `2nde.ses.valeur_ajoutee` : valeur ajoutée (chiffre d'affaires − consommations intermédiaires),
  PIB d'une petite île (somme des valeurs ajoutées) ;
- `2nde.ses.classement_va` : ranger des entreprises selon leur valeur ajoutée (énigme du Marché du
  Forum : la plus grosse vente n'est pas toujours la plus grande richesse créée) ;
- `2nde.ses.taux` : taux de variation, pourcentage de répartition, valeur d'arrivée ;
- `2nde.ses.moyenne_mediane` : moyenne et médiane d'une série de salaires ;
- `2nde.ses.equilibre` : prix d'équilibre et excédent d'offre ou de demande, lus dans un tableau ;
- `2nde.ses.chomage` : taux de chômage (chômeurs ÷ actifs × 100) ;
- `2nde.ses.classement_chomage` : ranger des groupes selon leur taux de chômage (énigme de la
  Maison Commune).

Montants écrits sans séparateur de milliers (« 1200 € »), lus « mille deux cents euros ».
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.formatting import fr_number

LEVEL = "2nde"


def _numeric(prompt: str, value: float, hint: str, explanation: str, difficulty: int,
             meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": "number", "value": fr_number(value).replace(",", ".").replace("−", "-")},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 30000 + 6000 * difficulty,
        "meta": meta,
    }


def _order(prompt: str, items: list[str], hint: str, explanation: str, difficulty: int,
           rng: random.Random, meta: dict[str, Any]) -> dict[str, Any]:
    shown = list(range(len(items)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": prompt,
        "choices": [items[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(items))]},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 30000 + 7000 * difficulty,
        "meta": meta,
    }


def _reg(code: str, notion: str, title: str, fn) -> Generator:
    return register(Generator(code=f"{LEVEL}.ses.{code}", level=LEVEL,
                              notion=f"{LEVEL}.ses.{notion}", role="chapitre", title=title,
                              generate=fn))


# --- Valeur ajoutée -----------------------------------------------------------------------------

FIRMS = ["la boulangerie", "la menuiserie", "l'atelier de vélos", "la ferme", "le garage",
         "l'imprimerie", "la fromagerie", "la librairie"]
VA_HINT = "Valeur ajoutée = chiffre d'affaires − consommations intermédiaires."


def cap(text: str) -> str:
    """Majuscule au début seulement (« CAP » reste en capitales)."""
    return text[0].upper() + text[1:]


def _firm(rng: random.Random, big: bool) -> tuple[int, int]:
    sales = rng.randrange(20, 120 if big else 60) * 100
    inputs = rng.randrange(5, sales // 100 - 3) * 100
    return sales, inputs


def _valeur_ajoutee(difficulty: int, rng: random.Random) -> dict[str, Any]:
    if difficulty <= 2 or difficulty == 4:
        name = rng.choice(FIRMS)
        sales, inputs = _firm(rng, difficulty > 2)
        va = sales - inputs
        if difficulty == 4:  # retrouver les consommations intermédiaires
            prompt = (f"Le chiffre d'affaires de {name} est de {sales} € et sa valeur ajoutée de "
                      f"{va} €. Quel est le montant de ses consommations intermédiaires, en "
                      "euros ?")
            why = f"{sales} − {va} = {inputs} € de consommations intermédiaires."
            return _numeric(prompt, inputs, VA_HINT, why, difficulty,
                            {"kind": "ci", "sales": sales, "va": va, "answer": inputs})
        prompt = (f"{cap(name)} vend pour {sales} € dans le mois et achète pour {inputs} € "
                  "de consommations intermédiaires. Quelle valeur ajoutée crée cette entreprise, "
                  "en euros ?")
        why = f"{sales} − {inputs} = {va} € de valeur ajoutée."
        return _numeric(prompt, va, VA_HINT, why, difficulty,
                        {"kind": "va", "sales": sales, "inputs": inputs, "answer": va})
    names = rng.sample(FIRMS, 3)
    firms = [_firm(rng, True) for _ in names]
    total = sum(s - i for s, i in firms)
    lines = [f"{cap(n)} : chiffre d'affaires {s} €, consommations intermédiaires {i} €"
             for n, (s, i) in zip(names, firms, strict=True)]
    prompt = ("Une petite île n'a que trois entreprises :\n" + "\n".join(lines)
              + "\nQuel est le PIB de l'île, en euros ?")
    why = ("Le PIB est la somme des valeurs ajoutées : "
           + " + ".join(str(s - i) for s, i in firms) + f" = {total} €.")
    return _numeric(prompt, total, "PIB = somme des valeurs ajoutées (et non des chiffres "
                    "d'affaires).", why, difficulty, {"kind": "pib", "firms": firms,
                                                       "answer": total})


VALEUR_AJOUTEE = _reg("valeur_ajoutee", "richesses.mesure", "Valeur ajoutée et PIB",
                      _valeur_ajoutee)


CLASSEMENT_VA = {1: 3, 2: 3, 3: 4, 4: 4, 5: 5}


def _classement_va(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count = CLASSEMENT_VA[difficulty]
    while True:
        names = rng.sample(FIRMS, count)
        firms = [_firm(rng, True) for _ in names]
        added = [s - i for s, i in firms]
        sales = [s for s, _i in firms]
        if len(set(added)) < count or min(abs(a - b) for a in added for b in added if a != b) < 300:
            continue
        # À partir de la difficulté 3, le classement par chiffre d'affaires est un piège.
        by_sales = sorted(range(count), key=lambda k: sales[k])
        by_added = sorted(range(count), key=lambda k: added[k])
        if difficulty < 3 or by_sales != by_added:
            break
    order = sorted(range(count), key=lambda k: added[k])
    items = [f"{cap(names[k])} : vend {firms[k][0]} €, achète {firms[k][1]} € de "
             "consommations intermédiaires" for k in order]
    return _order(
        "Le Spéculateur a mélangé les registres du marché ! Range ces entreprises, de celle qui "
        "crée le moins de richesse à celle qui en crée le plus.",
        items, "La richesse créée, c'est la valeur ajoutée : ce que l'on vend moins ce que l'on "
        "a acheté pour produire.",
        "Valeurs ajoutées, de la plus petite à la plus grande : "
        + " ; ".join(f"{names[k]} {added[k]} €" for k in order) + ".",
        difficulty, rng, {"added": [added[k] for k in order]})


CLASSEMENT_VA_GEN = _reg("classement_va", "richesses.mesure", "Qui crée le plus de richesse ?",
                         _classement_va)


# --- Taux de variation et répartition ----------------------------------------------------------

# (grandeur, unité, valeurs de départ plausibles)
SERIES = [("le prix d'un vélo", "€", [200, 250, 400, 500, 800]),
          ("le nombre d'abonnés d'un club", "", [40, 80, 120, 200, 400]),
          ("le chiffre d'affaires mensuel d'une librairie", "€", [4000, 8000, 10000, 12000]),
          ("le nombre d'élèves d'un lycée", "", [400, 800, 1000, 1200]),
          ("le loyer d'un appartement", "€", [400, 500, 800, 1000, 1200])]
RATES = [-40, -25, -20, -12.5, -10, -5, 5, 10, 12.5, 15, 20, 25, 30, 50]


def _amount(value: float, unit: str) -> str:
    return f"{fr_number(value)} €" if unit else fr_number(value)


def _taux(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kind = {1: "part", 2: "variation", 3: "variation", 4: "part", 5: "arrivee"}[difficulty]
    if kind == "part":
        while True:
            total = rng.choice([20, 25, 40, 50, 80, 200, 400, 500])
            share = rng.choice([5, 10, 12.5, 15, 20, 25, 30, 40, 60, 75])
            part = total * share / 100
            if part == int(part):
                break
        group = rng.choice([("élèves", "font du sport en club"), ("salariés", "travaillent à "
                            "temps partiel"), ("habitants", "ont moins de 20 ans")])
        prompt = (f"Sur {total} {group[0]}, {fr_number(part)} {group[1]}. Quelle part cela "
                  "représente-t-il, en pourcentage ?")
        why = f"{fr_number(part)} ÷ {total} × 100 = {fr_number(share)} %."
        return _numeric(prompt, share, "Part = partie ÷ total × 100.", why, difficulty,
                        {"kind": kind, "answer": share})
    what, unit, starts = rng.choice(SERIES)
    while True:
        start = rng.choice(starts)
        rate = rng.choice(RATES if difficulty >= 3 else [r for r in RATES if r == int(r)])
        end = start * (1 + rate / 100)
        if end == int(end):
            break
    sign = "+" if rate > 0 else "−"
    if kind == "variation":
        prompt = (f"Entre 2024 et 2025, {what} passe de {_amount(start, unit)} à "
                  f"{_amount(end, unit)}. Quel est le taux de variation, en pourcentage ? "
                  "Une baisse s'écrit avec un signe moins.")
        why = (f"({fr_number(end)} − {start}) ÷ {start} × 100 = {sign}"
               f"{fr_number(abs(rate))} %.")
        return _numeric(prompt, rate, "Taux de variation = (arrivée − départ) ÷ départ × 100.",
                        why, difficulty, {"kind": kind, "answer": rate})
    prompt = (f"En 2024, {what} vaut {_amount(start, unit)}. Il varie de {sign}"
              f"{fr_number(abs(rate))} % en un an. Quelle est sa valeur en 2025 ?")
    why = (f"Coefficient multiplicateur : 1 {'+' if rate > 0 else '−'} "
           f"{fr_number(abs(rate) / 100)} = {fr_number(1 + rate / 100)} ; {start} × "
           f"{fr_number(1 + rate / 100)} = {fr_number(end)}.")
    return _numeric(prompt, end, "Valeur d'arrivée = valeur de départ × (1 + taux ÷ 100).", why,
                    difficulty, {"kind": kind, "answer": end})


TAUX = _reg("taux", "demarche.donnees", "Taux de variation et répartition", _taux)


# --- Moyenne et médiane -------------------------------------------------------------------------

def _moyenne_mediane(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count = {1: 3, 2: 5, 3: 5, 4: 7, 5: 6}[difficulty]
    asked = "médian" if difficulty in (2, 4, 5) else "moyen"
    while True:
        wages = sorted(rng.randrange(14, 40) * 100 for _ in range(count))
        if difficulty >= 4:  # un très haut salaire tire la moyenne vers le haut
            wages[-1] = rng.randrange(80, 150) * 100
        if len(set(wages)) < count:
            continue
        mean = sum(wages) / count
        median = (wages[count // 2] if count % 2 else
                  (wages[count // 2 - 1] + wages[count // 2]) / 2)
        if mean == int(mean) and median == int(median):
            break
    shown = wages[:]
    rng.shuffle(shown)
    prompt = (f"Voici les salaires mensuels de {count} salariés d'une petite entreprise : "
              + ", ".join(f"{w} €" for w in shown)
              + f". Quel est le salaire {asked}, en euros ?")
    if asked == "moyen":
        why = f"({' + '.join(map(str, shown))}) ÷ {count} = {fr_number(mean)} €."
        value = mean
    else:
        middle = (f"la valeur du milieu est {fr_number(median)} €" if count % 2 else
                  f"la médiane est entre {wages[count // 2 - 1]} et {wages[count // 2]} : "
                  f"{fr_number(median)} €")
        why = ("Rangés : " + ", ".join(map(str, wages)) + f" ; {middle}. La moyenne serait "
               f"{fr_number(mean)} €.")
        value = median
    return _numeric(prompt, value, "Moyenne : somme ÷ effectif. Médiane : valeur du milieu de la "
                    "série rangée.", why, difficulty,
                    {"kind": asked, "wages": wages, "answer": value})


MOYENNE_MEDIANE = _reg("moyenne_mediane", "demarche.donnees", "Salaire moyen, salaire médian",
                       _moyenne_mediane)


# --- Prix d'équilibre ---------------------------------------------------------------------------

# (bien, écart entre deux prix du tableau, plus bas prix) : des prix plausibles.
GOODS = [("kilos de fraises", 1, 3), ("places de concert", 5, 20), ("pizzas", 1, 6),
         ("tee-shirts", 2, 8), ("vélos d'occasion", 20, 60)]


def _equilibre(difficulty: int, rng: random.Random) -> dict[str, Any]:
    good, step, first = rng.choice(GOODS)
    prices = [first + step * k for k in range(5)]
    eq = rng.randrange(1, 4)  # l'équilibre n'est jamais au bord du tableau
    quantity = rng.randrange(16, 30) * 10  # jamais de quantité négative au bord
    d_slope, s_slope = rng.randrange(2, 6) * 10, rng.randrange(2, 6) * 10
    demand = [quantity + d_slope * (eq - k) for k in range(5)]
    supply = [quantity + s_slope * (k - eq) for k in range(5)]
    table = "\n".join(f"Prix {p} € : demande {d}, offre {s}"
                      for p, d, s in zip(prices, demand, supply, strict=True))
    hint = "À l'équilibre, la quantité demandée égale la quantité offerte."
    meta = {"prices": prices, "demand": demand, "supply": supply, "eq": eq}
    if difficulty <= 3:
        prompt = f"Sur le marché des {good} :\n{table}\nQuel est le prix d'équilibre ?"
        choices = [f"{p} €" for p in prices]
        if difficulty == 1:
            keep = sorted({eq, *rng.sample([k for k in range(5) if k != eq], 2)})
            choices = [f"{prices[k]} €" for k in keep]
        right = f"{prices[eq]} €"
        return {
            "type": "mcq",
            "prompt": prompt,
            "choices": choices,
            "answer": {"kind": "choice", "index": choices.index(right)},
            "hint": hint,
            "explanation": f"À {prices[eq]} €, on demande et on offre {quantity} {good}.",
            "time_target_ms": 30000 + 6000 * difficulty,
            "meta": meta | {"answer": prices[eq]},
        }
    k = rng.choice([j for j in range(5) if j != eq])
    gap = abs(supply[k] - demand[k])
    what = "un excédent d'offre" if k > eq else "une pénurie (excédent de demande)"
    prompt = (f"Sur le marché des {good} :\n{table}\nLe prix est fixé à {prices[k]} €. Combien de "
              f"{good} manquent ou restent invendus à ce prix ?")
    why = (f"À {prices[k]} €, demande {demand[k]} et offre {supply[k]} : {what} de {gap}. "
           f"L'équilibre est à {prices[eq]} €.")
    return _numeric(prompt, gap, hint + " Ailleurs, l'écart est un excédent ou une pénurie.", why,
                    difficulty, meta | {"price": k, "answer": gap})


EQUILIBRE = _reg("equilibre", "marche.equilibre", "Le prix d'équilibre", _equilibre)


# --- Taux de chômage ----------------------------------------------------------------------------

CHOMAGE_RATES = [4, 5, 6, 7.5, 8, 10, 12.5, 15, 20, 25]


def _chomage(difficulty: int, rng: random.Random) -> dict[str, Any]:
    active = rng.choice([200, 400, 500, 800, 1000, 2000, 4000])
    rate = rng.choice(CHOMAGE_RATES if difficulty >= 3 else [5, 10, 20, 25])
    unemployed = active * rate / 100
    while unemployed != int(unemployed):
        active *= 2
        unemployed = active * rate / 100
    unemployed = int(unemployed)
    employed = active - unemployed
    hint = "Taux de chômage = chômeurs ÷ actifs × 100 ; actifs = personnes en emploi + chômeurs."
    town = rng.choice(["Clairval", "Brumegarde", "un village du royaume", "une petite ville"])
    if difficulty <= 2:
        prompt = (f"À {town}, il y a {active} actifs, dont {unemployed} chômeurs. Quel est le "
                  "taux de chômage, en pourcentage ?")
        why = f"{unemployed} ÷ {active} × 100 = {fr_number(rate)} %."
    else:
        prompt = (f"À {town}, {employed} personnes ont un emploi et {unemployed} sont au "
                  "chômage.")
        if difficulty >= 4:
            inactive = rng.randrange(3, 12) * 100
            prompt += f" {inactive} personnes sont inactives (élèves, retraités…)."
        prompt += " Quel est le taux de chômage, en pourcentage ?"
        why = (f"Actifs : {employed} + {unemployed} = {active}. Taux : {unemployed} ÷ {active} × "
               f"100 = {fr_number(rate)} %. Les inactifs ne comptent pas.")
    if town.startswith("un") or town.startswith("une"):
        prompt = prompt.replace(f"À {town}", f"Dans {town}")
    return _numeric(prompt, rate, hint, why, difficulty,
                    {"active": active, "unemployed": unemployed, "answer": rate})


CHOMAGE = _reg("chomage", "diplome.emploi", "Le taux de chômage", _chomage)


# Groupes de diplôme, du plus protégé au moins protégé (ordre des taux de chômage observés).
DIPLOMAS = ["les diplômés de bac + 3 ou plus", "les diplômés de bac + 2", "les bacheliers",
            "les titulaires d'un CAP ou d'un BEP", "les personnes sans diplôme"]
CLASSEMENT = {1: 3, 2: 3, 3: 4, 4: 4, 5: 5}


def _classement_chomage(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count = CLASSEMENT[difficulty]
    picked = sorted(rng.sample(range(len(DIPLOMAS)), count))
    rates = sorted(rng.sample([4, 5, 6, 8, 10, 12.5, 15, 20, 25], count))
    groups = []
    for k, rate in zip(picked, rates, strict=True):
        active = rng.choice([200, 400, 800, 1000, 2000])
        unemployed = active * rate / 100
        while unemployed != int(unemployed):
            active *= 2
            unemployed = active * rate / 100
        groups.append((DIPLOMAS[k], int(unemployed), active, rate))
    items = [f"{cap(name)} : {u} chômeurs pour {a} actifs" for name, u, a, _r in groups]
    return _order(
        "Le Fataliste a brouillé le registre des actifs ! Range ces groupes, du taux de chômage "
        "le plus faible au plus élevé.",
        items, "Calcule chaque taux : chômeurs ÷ actifs × 100. En moyenne, le diplôme protège du "
        "chômage.",
        "Taux de chômage : " + " ; ".join(f"{n} {fr_number(r)} %" for n, _u, _a, r in groups)
        + ".", difficulty, rng, {"rates": [r for *_x, r in groups], "ranks": picked})


CLASSEMENT_CHOMAGE = _reg("classement_chomage", "diplome.salaire", "Le registre des actifs",
                          _classement_chomage)
