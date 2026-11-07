"""SVT, seconde : générateurs calculés (questions illimitées et justes).

- `2nde.svt.microscope` : grossissement (objectif × oculaire) et taille réelle d'une cellule ;
- `2nde.svt.complementaire` : brin d'ADN complémentaire (A face à T, C face à G) ;
- `2nde.svt.capture` : effectif d'une population par capture-marquage-recapture (N = M × C ÷ R) ;
- `2nde.svt.frequences` : fréquence d'un allèle à partir des génotypes ;
- `2nde.svt.rendement` : végétaux nécessaires pour produire une masse d'animal d'élevage ;
- `2nde.svt.tailles` : ranger des niveaux d'organisation ou des tailles (énigme du Conservatoire
  du Vivant) ;
- `2nde.svt.sediments` : étapes du cycle des sédiments, ordre de dépôt quand le courant ralentit
  (énigme du Puits de la Vallée).

Unités abrégées après un nombre (µm, nm, mm), lues par engine/speech.py ; unité demandée en toutes
lettres. Séquences d'ADN en lettres majuscules, épelées par la lecture à voix haute.
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
        "answer": {"kind": "number", "value": fr_number(value).replace(",", ".")},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 25000 + 6000 * difficulty,
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
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": meta,
    }


def _reg(code: str, notion: str, title: str, fn) -> Generator:
    return register(Generator(code=f"{LEVEL}.svt.{code}", level=LEVEL,
                              notion=f"{LEVEL}.svt.{notion}", role="chapitre", title=title,
                              generate=fn))


# --- Microscope ---------------------------------------------------------------------------------

# Cellule observée et tailles réelles plausibles, en micromètres.
CELLS = [("une levure", (5, 8, 10)), ("un globule blanc", (10, 12, 15)),
         ("une cellule de la joue", (40, 50, 60)), ("une cellule de feuille d'élodée", (50, 80, 100)),
         ("une cellule d'épiderme d'oignon", (150, 200, 250)), ("une paramécie", (150, 200))]


def _microscope(difficulty: int, rng: random.Random) -> dict[str, Any]:
    hint = ("Grossissement = grossissement de l'objectif × grossissement de l'oculaire. "
            "Taille réelle = taille sur l'image ÷ grossissement ; 1 mm = 1 000 µm.")
    objective = rng.choice([4, 10, 40]) if difficulty > 1 else rng.choice([10, 40])
    ocular = rng.choice([10, 15]) if difficulty >= 4 else 10
    g = objective * ocular
    if difficulty == 1:
        return _numeric(
            f"Au microscope, l'objectif grossit {objective} fois et l'oculaire {ocular} fois. "
            "Quel est le grossissement total ?",
            g, hint, f"{objective} × {ocular} = {g} : l'image est {g} fois plus grande que "
            "l'objet.", difficulty, {"kind": "grossissement", "g": g})
    # Taille réelle en micromètres, choisie pour que l'image ait une mesure simple.
    while True:
        cell, sizes = rng.choice(CELLS)
        real = rng.choice(sizes)
        image_mm = real * g / 1000
        if 2 <= image_mm <= 120 and real * g % 100 == 0:  # mesure au dixième de millimètre
            break
        objective = rng.choice([4, 10, 40])
        g = objective * ocular
    if difficulty <= 3:
        intro = f"Au grossissement {g}, {cell} mesure {fr_number(image_mm)} mm sur l'image."
    else:
        intro = (f"Objectif {objective} fois, oculaire {ocular} fois : {cell} mesure "
                 f"{fr_number(image_mm)} mm sur l'image.")
    prompt = intro + " Quelle est sa taille réelle, en micromètres ?"
    why = (f"Grossissement : {objective} × {ocular} = {g}. Taille réelle : "
           f"{fr_number(image_mm)} mm ÷ {g} = {fr_number(image_mm / g)} mm, soit {real} µm.")
    return _numeric(prompt, real, hint, why, difficulty,
                    {"kind": "taille", "g": g, "image_mm": image_mm, "real": real})


MICROSCOPE = _reg("microscope", "organisation.cellules", "Le microscope", _microscope)


# --- Brin complémentaire ------------------------------------------------------------------------

PAIRS = {"A": "T", "T": "A", "C": "G", "G": "C"}
LENGTH = {1: 4, 2: 6, 3: 8, 4: 6, 5: 9}


def complement(strand: str) -> str:
    return "".join(PAIRS[n] for n in strand)


def _wrong_pairs(strand: str, swap: dict[str, str]) -> str:
    return "".join(swap[n] for n in strand)


def _complementaire(difficulty: int, rng: random.Random) -> dict[str, Any]:
    while True:
        strand = "".join(rng.choice("ATCG") for _ in range(LENGTH[difficulty]))
        right = complement(strand)
        wrong = [
            strand,  # le même brin
            _wrong_pairs(strand, {"A": "C", "C": "A", "T": "G", "G": "T"}),  # A face à C
            _wrong_pairs(strand, {"A": "G", "G": "A", "T": "C", "C": "T"}),  # A face à G
        ]
        if len({right, *wrong}) == 4:
            break
    prompt = (f"Un brin d'ADN porte la séquence {strand}. Quelle est la séquence du brin "
              "complémentaire, nucléotide par nucléotide en face ?")
    hint = "A fait face à T, et C fait face à G."
    why = f"En face de {strand}, on lit {right} : A fait face à T, et C fait face à G."
    meta = {"strand": strand, "complement": right}
    base = {"hint": hint, "explanation": why, "time_target_ms": 20000 + 6000 * difficulty,
            "meta": meta}
    if difficulty >= 4:
        return base | {
            "type": "text",
            "prompt": prompt + "\nÉcris-la en majuscules, sans espace.",
            "answer": {"kind": "text", "value": [right], "accents": False},
        }
    choices = [right, *wrong[: 2 if difficulty == 1 else 3]]
    rng.shuffle(choices)
    return base | {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(right)},
    }


COMPLEMENTAIRE = _reg("complementaire", "organisation.adn", "Le brin complémentaire",
                      _complementaire)


# --- Capture-marquage-recapture ----------------------------------------------------------------

SPECIES = [("carpes", "un étang"), ("lézards des murailles", "un vieux mur"),
           ("escargots", "un jardin"), ("papillons", "une prairie"),
           ("grenouilles vertes", "une mare"), ("campagnols", "un champ")]


def _capture(difficulty: int, rng: random.Random) -> dict[str, Any]:
    animals, place = rng.choice(SPECIES)
    marked = rng.choice([20, 25, 30, 40, 50, 60, 80, 100] if difficulty > 2 else [20, 30, 40, 50])
    recaptured = rng.randint(2, 6) if difficulty <= 2 else rng.randint(3, 15)
    ratio = rng.randint(2, 5) if difficulty <= 2 else rng.randint(2, 8)  # N = M × ratio
    second = recaptured * ratio
    total = marked * ratio
    prompt = (f"Dans {place}, on capture {marked} {animals}, on les marque et on les relâche. "
              f"Plus tard, on en capture {second} : {recaptured} portent une marque. "
              f"Estime le nombre de {animals} de la population.")
    why = (f"La proportion de marqués est la même dans l'échantillon et dans la population : "
           f"{recaptured} sur {second}. Effectif ≈ {marked} × {second} ÷ {recaptured} = {total}.")
    return _numeric(prompt, total, "Effectif ≈ marqués × capturés la deuxième fois ÷ "
                    "marqués recapturés.", why, difficulty,
                    {"marked": marked, "second": second, "recaptured": recaptured,
                     "total": total})


CAPTURE = _reg("capture", "biodiversite.echelles", "Capture, marquage, recapture", _capture)


# --- Fréquences alléliques ----------------------------------------------------------------------

TRAITS = [("B", "b", "lapins", "pelage brun", "pelage blanc"),
          ("N", "n", "phalènes du bouleau", "ailes noires", "ailes claires"),
          ("R", "r", "escargots", "coquille rose", "coquille jaune"),
          ("L", "l", "souris", "pelage long", "pelage court")]


def _frequences(difficulty: int, rng: random.Random) -> dict[str, Any]:
    big, small, animals, _t1, _t2 = rng.choice(TRAITS)
    size = 50 if difficulty <= 2 else rng.choice([25, 50])
    while True:
        homo = rng.randint(0, size)
        hetero = rng.randint(0, size - homo)
        rest = size - homo - hetero
        count = 2 * homo + hetero
        if rest > 0 and homo > 0 and hetero > 0:
            break
    asked = big if difficulty != 5 or rng.random() < 0.5 else small
    asked_count = count if asked == big else 2 * size - count
    value = asked_count / (2 * size)
    hint = ("Chaque individu porte deux allèles du gène. Fréquence = nombre d'allèles comptés ÷ "
            "nombre total d'allèles.")
    if difficulty == 1:
        prompt = (f"Dans une population de {size} {animals}, il y a {2 * size} allèles du gène. "
                  f"{count} sont l'allèle {big}. Quelle est la fréquence de l'allèle {big} ?")
        why = f"{count} ÷ {2 * size} = {fr_number(value)}."
    else:
        prompt = (f"Une population de {size} {animals} compte {homo} individus de génotype "
                  f"{big}{big}, {hetero} de génotype {big}{small} et {rest} de génotype "
                  f"{small}{small}. Quelle est la fréquence de l'allèle {asked} ?")
        two = 2 * homo if asked == big else 2 * rest
        why = (f"Allèles {asked} : 2 × {homo if asked == big else rest} + {hetero} = "
               f"{two + hetero}, sur {2 * size} allèles. Fréquence : {two + hetero} ÷ "
               f"{2 * size} = {fr_number(value)}.")
    return _numeric(prompt, value, hint, why, difficulty,
                    {"size": size, "genotypes": [homo, hetero, rest], "asked": asked,
                     "big": big})


FREQUENCES = _reg("frequences", "biodiversite.forces", "Fréquence d'un allèle", _frequences)


# --- Rendement de l'élevage ---------------------------------------------------------------------

# Part de la masse des végétaux mangés qui devient de la viande (ordres de grandeur de manuel).
LIVESTOCK = [("un bovin", "kg de viande de bœuf", 10), ("un porc", "kg de viande de porc", 20),
             ("un poulet", "kg de poulet", 25)]


def _rendement(difficulty: int, rng: random.Random) -> dict[str, Any]:
    animal, product, percent = LIVESTOCK[0] if difficulty <= 2 else rng.choice(LIVESTOCK)
    meat = rng.choice([5, 10, 20, 50, 100] if difficulty <= 3 else [15, 25, 40, 60, 150])
    plants = meat * 100 // percent
    hint = (f"Seuls {percent} % de la nourriture deviennent la masse de l'animal : il faut "
            f"{100 // percent} fois plus de végétaux.")
    if difficulty < 5:
        prompt = (f"Environ {percent} % de la masse de végétaux mangés par {animal} devient sa "
                  f"propre masse. Combien de kilogrammes de végétaux faut-il pour produire "
                  f"{meat} {product} ?")
        why = f"{meat} × 100 ÷ {percent} = {plants} kg de végétaux."
        return _numeric(prompt, plants, hint, why, difficulty,
                        {"percent": percent, "meat": meat, "answer": plants})
    prompt = (f"Environ {percent} % de la masse de végétaux mangés par {animal} devient sa "
              f"propre masse. Avec {plants} kg de végétaux, combien de kilogrammes de viande "
              "peut-on produire ?")
    why = f"{plants} × {percent} ÷ 100 = {meat} kg."
    return _numeric(prompt, meat, hint, why, difficulty,
                    {"percent": percent, "meat": meat, "answer": meat})


RENDEMENT = _reg("rendement", "agrosystemes.gestion", "Le rendement de l'élevage", _rendement)


# --- Énigme du Conservatoire du Vivant : tailles et niveaux d'organisation ---------------------

LEVELS_OF_LIFE = ["une molécule", "un organite", "une cellule", "un tissu", "un organe",
                  "un organisme", "une population", "un écosystème"]
# (objet, taille affichée, taille en micromètres) : valeurs moyennes de manuel.
SIZES = [
    ("une molécule d'hémoglobine", "5 nm", 0.005),
    ("un virus de la grippe", "100 nm", 0.1),
    ("une bactérie de l'intestin", "2 µm", 2),
    ("un globule rouge", "7 µm", 7),
    ("une cellule de la joue", "50 µm", 50),
    ("un ovule humain", "0,12 mm", 120),
    ("une paramécie", "0,2 mm", 200),
    ("une cellule d'épiderme d'oignon", "0,3 mm", 300),
]
TAILLES = {1: ("niveaux", 3), 2: ("niveaux", 5), 3: ("tailles", 4), 4: ("niveaux", 7),
           5: ("tailles", 5)}


def _tailles(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kind, count = TAILLES[difficulty]
    if kind == "niveaux":
        picked = sorted(rng.sample(range(len(LEVELS_OF_LIFE)), count))
        items = [LEVELS_OF_LIFE[i] for i in picked]
        return _order(
            "Le Brouille-Gènes a mélangé les étagères du Conservatoire ! Range ces niveaux "
            "d'organisation du vivant, du plus petit au plus grand.",
            items, "Une cellule contient des organites ; des cellules forment un tissu, des "
            "tissus un organe.", "Du plus petit au plus grand : " + " ; ".join(items) + ".",
            difficulty, rng, {"kind": kind, "ranks": picked})
    picked = sorted(rng.sample(SIZES, count), key=lambda s: s[2])
    items = [f"{name} : {size}" for name, size, _v in picked]
    return _order(
        "Le Brouille-Gènes a mélangé les lames du microscope ! Range ces objets, du plus petit "
        "au plus grand.",
        items, "1 mm = 1 000 µm et 1 µm = 1 000 nm.",
        "Du plus petit au plus grand : " + " ; ".join(items) + ".",
        difficulty, rng, {"kind": kind, "sizes": [v for _n, _s, v in picked]})


TAILLES_GEN = _reg("tailles", "organisation.cellules", "Du plus petit au plus grand", _tailles)


# --- Énigme du Puits de la Vallée : sédiments ---------------------------------------------------

CYCLE = ["l'altération de la roche", "l'érosion : les débris sont arrachés",
         "le transport par l'eau ou le vent", "la sédimentation : les débris se déposent",
         "la diagenèse : les sédiments deviennent une roche"]
PARTICLES = ["les blocs", "les galets", "les graviers", "les sables", "les limons", "les argiles"]
SEDIMENTS = {1: ("cycle", 3), 2: ("depot", 3), 3: ("cycle", 4), 4: ("depot", 5), 5: ("cycle", 5)}


def _sediments(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kind, count = SEDIMENTS[difficulty]
    if kind == "cycle":
        picked = sorted(rng.sample(range(len(CYCLE)), count))
        items = [CYCLE[i] for i in picked]
        return _order(
            "Le Rongeur a brouillé l'histoire d'une roche ! Remets ces étapes dans l'ordre, de "
            "la montagne au fond de la mer.",
            items, "La roche s'altère, puis l'érosion emporte ses débris ; ils voyagent, se "
            "déposent et finissent par redevenir une roche.",
            "Dans l'ordre : " + " ; ".join(items) + ".", difficulty, rng,
            {"kind": kind, "ranks": picked})
    picked = sorted(rng.sample(range(len(PARTICLES)), count))
    items = [PARTICLES[i] for i in picked]
    return _order(
        "Le courant d'une rivière ralentit peu à peu. Range ces particules, de la première "
        "déposée à la dernière.",
        items, "Plus le courant est lent, plus les particules qui se déposent sont fines.",
        "Les plus grosses se déposent d'abord : " + " ; ".join(items) + ".", difficulty, rng,
        {"kind": kind, "ranks": picked})


SEDIMENTS_GEN = _reg("sediments", "geosciences.sedimentation", "Le voyage des sédiments",
                     _sediments)
