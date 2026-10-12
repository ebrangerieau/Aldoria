"""Enquêtes du village (Tom, phase 3) : un habitant confie un document (relevé
statistique, tableau croisé) et pose trois questions de plus en plus difficiles sur ce
même document (PRD : « un PNJ donne un document à analyser »).

Générateurs à document partagé (`shared_document`) : à graine égale, le document est le
même quelle que soit la difficulté ; seule la question change. Le paquet d'une quête
prend donc trois difficultés consécutives avec une seule graine (session_pack).
Réservés aux quêtes (`combat=False`) : la question n'a de sens qu'avec le document.
"""

from __future__ import annotations

import random
from fractions import Fraction

from app.engine.generators import Generator, register
from app.engine.generators.formatting import fr_number, frac_text, sentence

# --- Relevé statistique ---------------------------------------------------------------

# (titre du relevé, intitulé de la ligne des valeurs, unité (singulier, pluriel), valeurs possibles)
_SURVEYS = [
    ("Temps de trajet jusqu'au marché", "Temps (min)", ("min", "min"), [5, 10, 15, 20, 25, 30]),
    ("Livres empruntés aux Archives ce mois-ci", "Livres", ("livre", "livres"), [0, 1, 2, 3, 4, 5]),
    ("Âge des apprentis de la guilde", "Âge (ans)", ("an", "ans"), [14, 15, 16, 17, 18, 19]),
    (
        "Nuits de garde sur les remparts cette semaine",
        "Nuits",
        ("nuit", "nuits"),
        [1, 2, 3, 4, 5, 6],
    ),
]
_TOTALS = (20, 25, 50)  # fréquences entières en %, moyenne à 2 décimales au plus


def _survey(difficulty: int, rng: random.Random) -> dict:
    title, label, (one, many), choices = rng.choice(_SURVEYS)
    k = rng.choice([5, 6])
    values = choices[:k]
    while True:
        counts = [rng.randint(1, 12) for _ in values]
        if sum(counts) in _TOTALS:
            break
    total = sum(counts)
    pick = rng.randrange(
        1, k - 1
    )  # valeur des questions de fréquence (ni la première ni la dernière)
    x, n = values[pick], counts[pick]
    x_text = f"{x} {one if x < 2 else many}"
    visual = {
        "kind": "table",
        "title": title,
        "rows": [[label, *map(str, values)], ["Effectif", *map(str, counts)]],
    }
    meta = {"values": values, "counts": counts}
    if difficulty == 1:
        prompt, value = "Combien de personnes ont répondu au relevé ?", str(total)
        hint = "L'effectif total est la somme des effectifs."
        explanation = f"{' + '.join(map(str, counts))} = {total}"
    elif difficulty == 2:
        freq = Fraction(100 * n, total)
        prompt = f"Quel pourcentage des personnes interrogées a répondu {x_text} ? (en %)"
        value = frac_text(freq)
        hint = "Fréquence = effectif de la valeur ÷ effectif total, puis × 100 pour un pourcentage."
        explanation = f"{n} ÷ {total} = {fr_number(Fraction(n, total))}, soit {value} %"
    elif difficulty == 3:
        cumulated = sum(counts[: pick + 1])
        freq = Fraction(100 * cumulated, total)
        prompt = f"Quel pourcentage des personnes interrogées a répondu {x_text} ou moins ? (en %)"
        value = frac_text(freq)
        hint = (
            "Additionne les effectifs des valeurs inférieures ou égales, puis calcule la fréquence."
        )
        explanation = (
            f"{' + '.join(map(str, counts[: pick + 1]))} = {cumulated} personnes ; "
            f"{cumulated} ÷ {total} = {fr_number(Fraction(cumulated, total))}, soit {value} %"
        )
    elif difficulty == 4:
        weighted = sum(v * c for v, c in zip(values, counts, strict=True))
        mean = Fraction(weighted, total)
        prompt = f"Quelle est la moyenne de ce relevé (en {many}) ?"
        value = fr_number(mean, 2)
        hint = "Moyenne = somme des (valeur × effectif) ÷ effectif total."
        explanation = f"{weighted} ÷ {total} = {value}"
        meta["mean"] = str(mean)
    else:
        ordered = [v for v, c in zip(values, counts, strict=True) for _ in range(c)]
        if total % 2:
            median = Fraction(ordered[total // 2])
            rank = f"la {total // 2 + 1}e valeur"
        else:
            median = Fraction(ordered[total // 2 - 1] + ordered[total // 2], 2)
            rank = f"la moyenne des {total // 2}e et {total // 2 + 1}e valeurs"
        prompt = f"Quelle est la médiane de ce relevé (en {many}) ?"
        value = fr_number(median, 2)
        hint = "Range les réponses dans l'ordre : la médiane partage l'effectif en deux moitiés."
        explanation = f"{total} réponses : la médiane est {rank}, soit {value}"
        meta["median"] = str(median)
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": "number", "value": value},
        "hint": hint,
        "explanation": sentence(explanation),
        "time_target_ms": 45000 + 10000 * difficulty,
        "visual": visual,
        "meta": meta | {"pick": pick},
    }


# --- Tableau croisé ------------------------------------------------------------------------

# (population, ligne 1, ligne 2, colonne 1, colonne 2, événement ligne, événement colonne)
_CROSSES = [
    (
        "habitants",
        ("Ville haute", "habite la ville haute"),
        ("Ville basse", "habite la ville basse"),
        ("A vu le Brouillard", "a déjà vu le Brouillard"),
        ("Ne l'a jamais vu", "n'a jamais vu le Brouillard"),
    ),
    (
        "gardes",
        ("Archers", "est archer"),
        ("Lanciers", "est lancier"),
        ("De nuit", "est de garde la nuit"),
        ("De jour", "est de garde le jour"),
    ),
    (
        "voyageurs",
        ("À cheval", "voyage à cheval"),
        ("À pied", "voyage à pied"),
        ("Venus du Nord", "vient du Nord"),
        ("Venus du Sud", "vient du Sud"),
    ),
]


def _cross(difficulty: int, rng: random.Random) -> dict:
    who, row1, row2, col1, col2 = rng.choice(_CROSSES)
    a, b, c, d = (rng.randint(6, 60) for _ in range(4))
    total = a + b + c + d
    visual = {
        "kind": "table",
        "title": f"Registre de {total} {who}",
        "rows": [
            ["", col1[0], col2[0], "Total"],
            [row1[0], str(a), str(b), str(a + b)],
            [row2[0], str(c), str(d), str(c + d)],
            ["Total", str(a + c), str(b + d), str(total)],
        ],
        "totals": True,
    }
    events = f"On note L : « il {row1[1]} » et C : « il {col1[1]} »."
    intro = f"On choisit au hasard un des {total} {who}. {events}"
    if difficulty == 1:
        q, num, den = "Calcule P(L).", a + b, total
        explanation = f"{a + b} {who} sur {total} : P(L) = {a + b}/{total}"
    elif difficulty == 2:
        q, num, den = "Calcule P(L ∩ C).", a, total
        explanation = f"{a} {who} vérifient L et C : P(L ∩ C) = {a}/{total}"
    elif difficulty == 3:
        q, num, den = "Calcule P_L(C), la probabilité de C sachant L.", a, a + b
        explanation = (
            f"Parmi les {a + b} {who} de la ligne L, {a} vérifient C : P_L(C) = {a}/{a + b}"
        )
    elif difficulty == 4:
        q, num, den = "Calcule P_C(L), la probabilité de L sachant C.", a, a + c
        explanation = (
            f"Parmi les {a + c} {who} de la colonne C, {a} vérifient L : P_C(L) = {a}/{a + c}"
        )
    else:
        q, num, den = "Calcule P(L ∪ C).", a + b + c, total
        explanation = (
            f"P(L ∪ C) = P(L) + P(C) − P(L ∩ C) = ({a + b} + {a + c} − {a})/{total} = "
            f"{a + b + c}/{total}"
        )
    return {
        "type": "numeric",
        "prompt": f"{intro} {q} (fraction)",
        "answer": {
            "kind": "fraction",
            "value": frac_text(Fraction(num, den)),
            "accept_equivalent": True,
        },
        "hint": "Sachant L : on ne regarde que la ligne L. Sans « sachant » : on divise par le total.",
        "explanation": sentence(explanation),
        "time_target_ms": 50000 + 10000 * difficulty,
        "visual": visual,
        "meta": {"table": [a, b, c, d], "num": num, "den": den},
    }


def _document_gen(code: str, notion: str, title: str, fn) -> Generator:
    return register(
        Generator(
            code=code,
            level="2nde",
            notion=notion,
            role="chapitre",
            title=title,
            generate=fn,
            combat=False,
            shared_document=True,
        )
    )


SURVEY = _document_gen(
    "2nde.statistiques.enquete",
    "2nde.maths.statistiques.indicateurs",
    "Enquête : relevé statistique",
    _survey,
)
CROSS_TABLE = _document_gen(
    "2nde.probabilites.enquete",
    "2nde.maths.probabilites.conditionnelles",
    "Enquête : tableau croisé",
    _cross,
)
