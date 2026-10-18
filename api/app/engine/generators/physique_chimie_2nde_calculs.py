"""Physique-chimie, seconde : générateurs calculés (questions illimitées et justes).

- `masse_volumique` : ρ = m ÷ V, masse, volume, identifier un corps, g/cm³ → kg/m³ ;
- `concentration` : concentration en masse, masse de soluté, dilution ;
- `composition_noyau` : protons, neutrons, nucléons, électrons d'un atome ou d'un ion ;
- `configuration` : configuration électronique (Z ≤ 18), électrons de valence, période, ion stable ;
- `quantite_matiere` : n = N ÷ NA, N = n × NA, n à partir de la masse d'une entité ;
- `energie_etat` : Q = m × L (fusion de la glace, vaporisation de l'eau) ;
- `equation` : coefficient manquant d'une équation, équation bien ajustée (éléments et charges) ;
- `reactif_limitant` : réactif limitant, quantité restante ;
- `vitesse_moyenne` : v = d ÷ t, km/h ↔ m/s, chronophotographie ;
- `poids_gravitation` : P = m × g, effet de la distance et des masses sur la gravitation ;
- `distance_son` : orage, écho, sonar ;
- `periode_frequence` : f = 1 ÷ T, infrasons et ultrasons ;
- `refraction` : réflexion, Snell-Descartes (angle, indice) ;
- `image_lentille` : taille de l'image (Thalès), grandissement ;
- `noeuds_mailles` et `loi_ohm` : circuits ;
- énigmes à remettre en ordre : `echelles` (Alambic des Éléments), `sons` (Laboratoire foudroyé).
"""

from __future__ import annotations

import math
import random
import re
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.formatting import fr_number

LEVEL, SUBJECT = "2nde", "physique_chimie"
PREFIX = f"{LEVEL}.{SUBJECT}"
NA = 6.02e23

_SUP = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")
_SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
_UNSUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_UNSUP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")


def sci(value: float, digits: int = 3) -> str:
    """6.02e23 → « 6,02 × 10²³ » (chiffres significatifs : `digits`)."""
    exponent = math.floor(math.log10(abs(value)))
    mantissa = round(value / 10**exponent, digits - 1)
    if abs(mantissa) >= 10:
        mantissa, exponent = round(mantissa / 10, digits - 1), exponent + 1
    if exponent == 0:
        return fr_number(mantissa)
    return f"{fr_number(mantissa)} × 10{str(exponent).translate(_SUP)}"


def _number(value: float) -> str:
    """Valeur attendue dans `answer.value` (point décimal, sans signe typographique)."""
    return fr_number(value).replace(",", ".").replace("−", "-")


def _numeric(prompt: str, value: float, hint: str, explanation: str, difficulty: int,
             meta: dict[str, Any], tolerance: float = 0.0) -> dict[str, Any]:
    answer: dict[str, Any] = {"kind": "number", "value": _number(value)}
    if tolerance:
        answer["tolerance"] = tolerance
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": answer,
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 25000 + 7000 * difficulty,
        "meta": {**meta, "value": value},
    }


def _mcq(prompt: str, right: str, wrong: list[str], hint: str, explanation: str,
         difficulty: int, rng: random.Random, meta: dict[str, Any]) -> dict[str, Any]:
    others = list(dict.fromkeys(w for w in wrong if w != right))
    count = 3 if difficulty == 1 else 4
    choices = rng.sample(others, min(count - 1, len(others))) + [right]
    rng.shuffle(choices)
    return {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(right)},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {**meta, "right": right},
    }


def _order(prompt: str, labels_in_order: list[str], rng: random.Random, hint: str,
           explanation: str, difficulty: int, meta: dict[str, Any]) -> dict[str, Any]:
    shown = list(labels_in_order)
    while shown == labels_in_order:
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": prompt,
        "choices": shown,
        "answer": {"kind": "order", "value": [shown.index(label) for label in labels_in_order]},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 30000 + 8000 * difficulty,
        "meta": meta,
    }


def _reg(name: str, notion: str, title: str, generate) -> Generator:
    return register(
        Generator(
            code=f"{PREFIX}.{name}",
            level=LEVEL,
            notion=f"{PREFIX}.{notion}",
            role="chapitre",
            title=title,
            generate=generate,
        )
    )


# --- Masse volumique ---------------------------------------------------------------------------

# (nom, masse volumique en g/cm³ ou g/mL, liquide ?) : valeurs usuelles des manuels.
SUBSTANCES = [
    ("l'eau", 1.0, True), ("l'éthanol", 0.79, True), ("l'huile de tournesol", 0.92, True),
    ("l'aluminium", 2.7, False), ("le fer", 7.9, False), ("le cuivre", 8.9, False),
    ("le plomb", 11.3, False), ("l'or", 19.3, False), ("l'argent", 10.5, False),
]
VOLUMES = [10, 20, 50, 100, 200, 250]


def _masse_volumique(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = ["rho", "masse"] + (["volume"] if difficulty >= 2 else [])
    kinds += ["identifier", "conversion"] if difficulty >= 4 else ["identifier"] * (difficulty >= 3)
    kind = rng.choice(kinds)
    name, rho, liquid = rng.choice(SUBSTANCES)
    vol_unit, rho_unit = ("mL", "g/mL") if liquid else ("cm³", "g/cm³")
    volume = rng.choice(VOLUMES)
    mass = round(rho * volume, 2)
    hint = "Masse volumique = masse ÷ volume."
    meta = {"kind": kind, "substance": name}
    if kind == "rho":
        return _numeric(
            f"Un échantillon {_de(_bare(name))} a une masse de {fr_number(mass)} g pour un volume de {volume} {vol_unit}. "
            f"Quelle est sa masse volumique, en grammes par {'millilitre' if liquid else 'centimètre cube'} ?",
            rho, hint, f"ρ = m ÷ V = {fr_number(mass)} ÷ {volume} = {fr_number(rho)} {rho_unit}.",
            difficulty, meta, tolerance=0.01,
        )
    if kind == "masse":
        return _numeric(
            f"La masse volumique de {name} vaut {fr_number(rho)} {rho_unit}. Quelle est la masse de "
            f"{volume} {vol_unit} {_de(_bare(name))}, en grammes ?",
            mass, "Masse = masse volumique × volume.",
            f"m = ρ × V = {fr_number(rho)} × {volume} = {fr_number(mass)} g.", difficulty, meta,
            tolerance=0.01,
        )
    if kind == "volume":
        return _numeric(
            f"La masse volumique de {name} vaut {fr_number(rho)} {rho_unit}. Quel volume occupent "
            f"{fr_number(mass)} g {_de(_bare(name))}, en "
            f"{'millilitres' if liquid else 'centimètres cubes'} ?",
            volume, "Volume = masse ÷ masse volumique.",
            f"V = m ÷ ρ = {fr_number(mass)} ÷ {fr_number(rho)} = {volume} {vol_unit}.", difficulty,
            meta, tolerance=0.01,
        )
    if kind == "conversion":
        return _numeric(
            f"La masse volumique de {name} vaut {fr_number(rho)} g/cm³. Convertis-la en kilogrammes "
            "par mètre cube.",
            rho * 1000, "1 g/cm³ = 1 000 kg/m³ (1 m³ = 1 000 000 cm³ et 1 kg = 1 000 g).",
            f"{fr_number(rho)} g/cm³ = {fr_number(rho * 1000)} kg/m³.", difficulty, meta,
        )
    # Identifier le corps à partir de sa masse volumique calculée.
    same = [s for s in SUBSTANCES if s[2] == liquid and s[0] != name]
    wrong = [s[0] for s in same if abs(s[1] - rho) > 0.05]
    return _mcq(
        f"Un {'liquide' if liquid else 'métal'} pur a une masse de {fr_number(mass)} g pour "
        f"{volume} {vol_unit}. De quel corps s'agit-il ?",
        name, wrong, "Calcule sa masse volumique, puis compare aux valeurs connues : eau 1,0 ; "
        "éthanol 0,79 ; huile 0,92 ; aluminium 2,7 ; fer 7,9 ; cuivre 8,9 ; argent 10,5 ; "
        "plomb 11,3 ; or 19,3 (en g/mL ou g/cm³).",
        f"ρ = {fr_number(mass)} ÷ {volume} = {fr_number(rho)} {rho_unit} : c'est {name}.",
        difficulty, rng, meta,
    )


def _bare(name: str) -> str:
    """« l'eau » → « eau », « le fer » → « fer » (après « de »)."""
    return re.sub(r"^(?:l'|le |la )", "", name)


MASSE_VOLUMIQUE = _reg("masse_volumique", "matiere.masse_volumique", "Masse volumique",
                       _masse_volumique)


# --- Solutions : concentration en masse, dilution ---------------------------------------------

SOLUTES = ["de sucre", "de sel", "de sulfate de cuivre", "de glucose", "de permanganate de potassium"]


def _concentration(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = ["cm", "masse"] + (["dilution_volume", "dilution_cm"] if difficulty >= 3 else [])
    kind = rng.choice(kinds)
    solute = rng.choice(SOLUTES)
    meta = {"kind": kind}
    if kind in ("cm", "masse"):
        cm = rng.choice([2, 5, 10, 20, 25, 40, 50, 100])
        volume = rng.choice([50, 100, 200, 250, 500] if difficulty >= 2 else [100, 250, 500])
        mass = cm * volume / 1000
        if kind == "cm":
            return _numeric(
                f"On dissout {fr_number(mass)} g {solute} dans de l'eau, pour obtenir {volume} mL de "
                "solution. Quelle est la concentration en masse, en grammes par litre ?",
                cm, "Concentration en masse = masse de soluté ÷ volume de solution, en litres.",
                f"{volume} mL = {fr_number(volume / 1000)} L ; Cm = {fr_number(mass)} ÷ "
                f"{fr_number(volume / 1000)} = {cm} g/L.", difficulty, meta, tolerance=0.01,
            )
        return _numeric(
            f"Quelle masse {solute} faut-il dissoudre pour préparer {volume} mL de solution à "
            f"{cm} g/L ? Réponds en grammes.",
            mass, "Masse = concentration en masse × volume, en litres.",
            f"m = {cm} × {fr_number(volume / 1000)} = {fr_number(mass)} g.", difficulty, meta,
            tolerance=0.01,
        )
    factor = rng.choice([2, 4, 5, 10] if difficulty < 5 else [2, 4, 5, 10, 20, 25])
    v_fille = rng.choice([50, 100, 200, 250, 500])
    while v_fille % factor:
        v_fille = rng.choice([100, 200, 500])
    c_mere = rng.choice([10, 20, 50, 100, 200])
    v_mere = v_fille // factor
    c_fille = c_mere / factor
    if kind == "dilution_volume":
        return _numeric(
            f"On veut préparer {v_fille} mL d'une solution {factor} fois moins concentrée que la "
            "solution mère. Quel volume de solution mère faut-il prélever, en millilitres ?",
            v_mere, "Facteur de dilution = volume de la fille ÷ volume de la mère prélevé.",
            f"V mère = {v_fille} ÷ {factor} = {v_mere} mL, complétés avec de l'eau jusqu'à "
            f"{v_fille} mL.", difficulty, meta,
        )
    return _numeric(
        f"On prélève {v_mere} mL d'une solution à {c_mere} g/L et on complète avec de l'eau "
        f"jusqu'à {v_fille} mL. Quelle est la nouvelle concentration en masse, en grammes par "
        "litre ?",
        c_fille, "La masse de soluté se conserve : C mère × V mère = C fille × V fille.",
        f"Le volume est multiplié par {factor} : {c_mere} ÷ {factor} = {fr_number(c_fille)} g/L.",
        difficulty, meta, tolerance=0.01,
    )


CONCENTRATION = _reg("concentration", "matiere.solutions", "Concentration et dilution",
                     _concentration)


# --- Le noyau de l'atome -------------------------------------------------------------------------

# (nom, symbole, Z, A) : isotopes courants des manuels.
NUCLEI = [
    ("hydrogène", "H", 1, 1), ("hélium", "He", 2, 4), ("lithium", "Li", 3, 7),
    ("carbone", "C", 6, 12), ("carbone", "C", 6, 14), ("azote", "N", 7, 14),
    ("oxygène", "O", 8, 16), ("fluor", "F", 9, 19), ("néon", "Ne", 10, 20),
    ("sodium", "Na", 11, 23), ("magnésium", "Mg", 12, 24), ("aluminium", "Al", 13, 27),
    ("silicium", "Si", 14, 28), ("phosphore", "P", 15, 31), ("soufre", "S", 16, 32),
    ("chlore", "Cl", 17, 35), ("chlore", "Cl", 17, 37), ("argon", "Ar", 18, 40),
    ("potassium", "K", 19, 39), ("calcium", "Ca", 20, 40), ("fer", "Fe", 26, 56),
    ("cuivre", "Cu", 29, 63), ("zinc", "Zn", 30, 64), ("argent", "Ag", 47, 107),
    ("or", "Au", 79, 197), ("uranium", "U", 92, 235), ("uranium", "U", 92, 238),
]
# Ions monoatomiques du programme (et quelques autres courants) : (nom, symbole, Z, charge).
IONS = [
    ("l'ion sodium", "Na", 11, 1), ("l'ion potassium", "K", 19, 1), ("l'ion hydrogène", "H", 1, 1),
    ("l'ion calcium", "Ca", 20, 2), ("l'ion magnésium", "Mg", 12, 2), ("l'ion chlorure", "Cl", 17, -1),
    ("l'ion fluorure", "F", 9, -1), ("l'ion oxyde", "O", 8, -2), ("l'ion aluminium", "Al", 13, 3),
]


def ion_formula(symbol: str, charge: int) -> str:
    """("Ca", 2) → « Ca²⁺ » ; ("Cl", -1) → « Cl⁻ »."""
    size = "" if abs(charge) == 1 else str(abs(charge)).translate(_SUP)
    return f"{symbol}{size}{'⁺' if charge > 0 else '⁻'}"


def _de(name: str) -> str:
    return f"d'{name}" if name[0] in "aeéiouyh" else f"de {name}"


def _composition_noyau(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["protons", "nucleons"], 2: ["protons", "neutrons", "electrons"],
             3: ["neutrons", "masse", "electrons"], 4: ["neutrons", "ion", "masse"],
             5: ["ion", "neutrons", "masse"]}[difficulty]
    kind = rng.choice(kinds)
    if kind == "ion":
        name, symbol, z, charge = rng.choice(IONS)
        electrons = z - charge
        gained = "perdu" if charge > 0 else "gagné"
        return _numeric(
            f"Combien d'électrons possède {name} {ion_formula(symbol, charge)} ? Le numéro "
            f"atomique de cet élément est Z = {z}.",
            electrons, "Un ion positif a perdu des électrons, un ion négatif en a gagné.",
            f"L'atome a {z} électrons ; l'ion en a {gained} {abs(charge)} : {electrons} électrons.",
            difficulty, {"kind": kind, "z": z, "charge": charge},
        )
    pool = NUCLEI if difficulty >= 3 else [n for n in NUCLEI if n[2] <= 20]
    name, symbol, z, a = rng.choice(pool)
    label = f"Un noyau {_de(name)} {a} ({symbol}) a pour numéro atomique Z = {z} et pour nombre de masse A = {a}."
    meta = {"kind": kind, "z": z, "a": a}
    if kind == "protons":
        return _numeric(f"{label} Combien contient-il de protons ?", z,
                        "Z est le nombre de protons.", f"Z = {z} : {z} protons.", difficulty, meta)
    if kind == "nucleons":
        return _numeric(f"{label} Combien contient-il de nucléons ?", a,
                        "A est le nombre de nucléons (protons et neutrons).",
                        f"A = {a} : {a} nucléons.", difficulty, meta)
    if kind == "neutrons":
        return _numeric(f"{label} Combien contient-il de neutrons ?", a - z,
                        "Neutrons = A − Z.", f"N = A − Z = {a} − {z} = {a - z} neutrons.",
                        difficulty, meta)
    if kind == "electrons":
        return _numeric(
            f"L'atome {_de(name)} ({symbol}) a pour numéro atomique Z = {z}. Combien a-t-il "
            "d'électrons ?", z, "Un atome est neutre : autant d'électrons que de protons.",
            f"{z} protons, donc {z} électrons.", difficulty, meta)
    return _numeric(
        f"Un noyau {_de(name)} contient {z} protons et {a - z} neutrons. Quel est son nombre de "
        "masse A ?", a, "A = nombre de protons + nombre de neutrons.",
        f"A = {z} + {a - z} = {a}.", difficulty, meta)


COMPOSITION_NOYAU = _reg("composition_noyau", "atome.noyau", "Composition d'un noyau",
                         _composition_noyau)


# --- Configuration électronique ------------------------------------------------------------------

ELEMENTS_18 = [
    "", "hydrogène", "hélium", "lithium", "béryllium", "bore", "carbone", "azote", "oxygène",
    "fluor", "néon", "sodium", "magnésium", "aluminium", "silicium", "phosphore", "soufre",
    "chlore", "argon",
]
SYMBOLS_18 = ["", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si",
              "P", "S", "Cl", "Ar"]
SUBSHELLS = [("1s", 2), ("2s", 2), ("2p", 6), ("3s", 2), ("3p", 6)]
# Ions stables formés par les atomes (Z ≤ 18) qui en forment un couramment.
STABLE_CHARGE = {1: 1, 3: 1, 4: 2, 8: -2, 9: -1, 11: 1, 12: 2, 13: 3, 16: -2, 17: -1}
FAMILIES = {3: "alcalins", 11: "alcalins", 9: "halogènes", 17: "halogènes", 2: "gaz nobles",
            10: "gaz nobles", 18: "gaz nobles", 4: "alcalino-terreux", 12: "alcalino-terreux"}


def configuration(z: int) -> list[tuple[str, int]]:
    out, left = [], z
    for name, size in SUBSHELLS:
        if left <= 0:
            break
        out.append((name, min(size, left)))
        left -= size
    return out


def config_text(z: int) -> str:
    return " ".join(f"{name}{str(count).translate(_SUP)}" for name, count in configuration(z))


def valence(z: int) -> int:
    shells = configuration(z)
    last = shells[-1][0][0]
    return sum(count for name, count in shells if name[0] == last)


def period(z: int) -> int:
    return int(configuration(z)[-1][0][0])


def _configuration(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["config"], 2: ["config", "valence"], 3: ["valence", "periode", "z"],
             4: ["valence", "ion", "z", "famille"], 5: ["ion", "famille", "valence", "z"]}[difficulty]
    kind = rng.choice(kinds)
    if kind == "ion":
        z = rng.choice(sorted(STABLE_CHARGE))
    elif kind == "famille":
        z = rng.choice(sorted(FAMILIES))
    else:
        z = rng.randint(1, 10 if difficulty <= 2 else 18)
    name = ELEMENTS_18[z]
    atom = f"l'atome {_de(name)} (Z = {z})"
    meta = {"kind": kind, "z": z}
    if kind == "config":
        wrong = [config_text(w) for w in (z - 2, z - 1, z + 1, z + 2) if 1 <= w <= 18]
        return _mcq(
            f"Quelle est la configuration électronique de {atom} ?", config_text(z), wrong,
            "On remplit dans l'ordre 1s, 2s, 2p, 3s, 3p : 2 électrons au plus dans une sous-couche "
            "s, 6 dans une sous-couche p.",
            f"{z} électrons : {config_text(z)}.", difficulty, rng, meta,
        )
    if kind == "valence":
        return _numeric(
            f"Combien d'électrons de valence possède {atom} ?", valence(z),
            "Les électrons de valence sont ceux de la dernière couche occupée (le plus grand "
            "nombre devant s ou p).",
            f"Configuration : {config_text(z)}. Dernière couche : {valence(z)} électrons.",
            difficulty, meta,
        )
    if kind == "periode":
        return _numeric(
            f"Dans quelle ligne (période) du tableau périodique se trouve {atom} ?", period(z),
            "Le numéro de la ligne est celui de la dernière couche occupée.",
            f"Configuration : {config_text(z)} ; dernière couche n = {period(z)}.", difficulty, meta,
        )
    if kind == "z":
        return _numeric(
            f"Un atome a pour configuration électronique {config_text(z)}. Quel est son numéro "
            "atomique Z ?", z, "Additionne les électrons de toutes les sous-couches.",
            f"{' + '.join(str(c) for _n, c in configuration(z))} = {z} : c'est {name}.",
            difficulty, meta,
        )
    if kind == "famille":
        family = FAMILIES[z]
        return _mcq(
            f"À quelle famille appartient {atom} ?", f"les {family}",
            [f"les {f}" for f in ("alcalins", "halogènes", "gaz nobles", "alcalino-terreux")],
            "Une famille, c'est une colonne du tableau : même nombre d'électrons de valence.",
            f"Configuration : {config_text(z)} ; {valence(z)} électron(s) de valence : famille des "
            f"{family}.", difficulty, rng, meta,
        )
    charge = STABLE_CHARGE[z]
    symbol = SYMBOLS_18[z]
    right = ion_formula(symbol, charge)
    wrong = [ion_formula(symbol, c) for c in (1, 2, 3, -1, -2, -3) if c != charge]
    how = f"perd {charge}" if charge > 0 else f"gagne {-charge}"
    return _mcq(
        f"Quel ion monoatomique stable forme {atom} ?", right, wrong,
        "L'atome gagne ou perd des électrons pour avoir la configuration du gaz noble le plus "
        "proche.",
        f"Configuration : {config_text(z)}. L'atome {how} électron(s) : {right}.",
        difficulty, rng, {**meta, "charge": charge},
    )


CONFIGURATION = _reg("configuration", "atome.configuration", "Configuration électronique",
                     _configuration)


# --- Quantité de matière ---------------------------------------------------------------------

# (entités, une entité, nom de l'espèce, masse molaire en g/mol pour fabriquer les données)
SPECIES = [
    ("molécules d'eau", "une molécule d'eau", "d'eau", 18),
    ("molécules de dioxyde de carbone", "une molécule de dioxyde de carbone",
     "de dioxyde de carbone", 44),
    ("molécules de dioxygène", "une molécule de dioxygène", "de dioxygène", 32),
    ("molécules de méthane", "une molécule de méthane", "de méthane", 16),
    ("atomes de fer", "un atome de fer", "de fer", 56),
    ("atomes de carbone", "un atome de carbone", "de carbone", 12),
]
AMOUNTS = [0.1, 0.2, 0.25, 0.5, 1.5, 2, 3, 4, 5, 10]


def _quantite_matiere(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["n"], 2: ["n", "N"], 3: ["n", "N", "masse"], 4: ["masse", "N", "n"],
             5: ["masse", "N"]}[difficulty]
    kind = rng.choice(kinds)
    entity, one, species, molar = rng.choice(SPECIES)
    n = rng.choice(AMOUNTS)
    hint = "n = N ÷ NA, avec NA = 6,02 × 10²³ par mole."
    meta = {"kind": kind, "n": n}
    if kind == "n":
        return _numeric(
            f"Un échantillon contient {sci(n * NA, 4)} {entity}. Quelle est sa quantité de "
            "matière, en moles ? (NA = 6,02 × 10²³ par mole)",
            n, hint, f"n = {sci(n * NA, 4)} ÷ (6,02 × 10²³) = {fr_number(n)} mol.", difficulty,
            meta, tolerance=0.01,
        )
    if kind == "N":
        right = sci(n * NA)
        wrong = [sci(n * NA * 10), sci(n * NA / 10), sci(NA / n) if n != 1 else sci(NA * 100),
                 sci(n * NA * 100)]
        return _mcq(
            f"Combien y a-t-il de {entity} dans {fr_number(n)} mol {species} ? "
            "(NA = 6,02 × 10²³ par mole)", right, wrong, "N = n × NA.",
            f"N = {fr_number(n)} × 6,02 × 10²³ = {right}.", difficulty, rng, meta,
        )
    # À partir de la masse d'une entité (en kg) et de la masse de l'échantillon (en g).
    entity_kg = float(f"{molar / NA / 1000:.2e}")  # trois chiffres significatifs, comme affiché
    sample_g = n * molar
    count = sample_g / 1000 / entity_kg
    value = round(count / NA, 2)
    return _numeric(
        f"{one[0].upper() + one[1:]} a une masse de "
        f"{sci(entity_kg)} kg. Quelle est la quantité de matière dans {fr_number(sample_g)} g "
        f"{species}, en moles ? (NA = 6,02 × 10²³ par mole)",
        value, "Nombre d'entités = masse de l'échantillon ÷ masse d'une entité (mêmes unités), "
        "puis n = N ÷ NA.",
        f"N = {fr_number(sample_g / 1000)} kg ÷ {sci(entity_kg)} kg = {sci(count)} ; "
        f"n = N ÷ NA ≈ {fr_number(value)} mol.", difficulty, meta, tolerance=0.02,
    )


QUANTITE_MATIERE = _reg("quantite_matiere", "atome.mole", "Quantité de matière",
                        _quantite_matiere)


# --- Énergie de changement d'état -----------------------------------------------------------

# (changement, espèce, énergie massique en kJ/kg)
STATE_CHANGES = [("faire fondre", "de glace", 334), ("vaporiser", "d'eau", 2260),
                 ("faire fondre", "d'aluminium", 397)]


def _energie_etat(difficulty: int, rng: random.Random) -> dict[str, Any]:
    verb, species, latent = rng.choice(STATE_CHANGES if difficulty >= 3 else STATE_CHANGES[:2])
    kg = rng.choice([1, 2, 0.5, 3] if difficulty <= 2 else [0.25, 0.2, 1.5, 0.75, 0.1, 2.5])
    energy = round(kg * latent, 2)
    meta = {"latent": latent, "kg": kg}
    if difficulty >= 4 and rng.random() < 0.5:
        return _numeric(
            f"Il faut {fr_number(energy)} kJ pour {verb} une masse {species}. L'énergie massique de "
            f"ce changement d'état vaut {latent} kJ/kg. Quelle est cette masse, en kilogrammes ?",
            kg, "Q = m × L, donc m = Q ÷ L.",
            f"m = {fr_number(energy)} ÷ {latent} = {fr_number(kg)} kg.", difficulty,
            {**meta, "kind": "masse"}, tolerance=0.01,
        )
    amount = f"{fr_number(kg * 1000)} g" if difficulty >= 3 and kg < 1 else f"{fr_number(kg)} kg"
    return _numeric(
        f"Quelle énergie faut-il pour {verb} {amount} {species} ? L'énergie massique de ce "
        f"changement d'état vaut {latent} kJ/kg. Réponds en kilojoules.",
        energy, "Q = m × L, avec m en kilogrammes.",
        f"Q = {fr_number(kg)} × {latent} = {fr_number(energy)} kJ.", difficulty,
        {**meta, "kind": "energie"}, tolerance=0.01,
    )


ENERGIE_ETAT = _reg("energie_etat", "transformations.physique", "Énergie de changement d'état",
                    _energie_etat)


# --- Équations de réaction ---------------------------------------------------------------------

# (réactifs, produits, niveau) : coefficients stœchiométriques ; ions avec leur charge.
REACTIONS = [
    ([(1, "C"), (1, "O₂")], [(1, "CO₂")], 1),
    ([(2, "H₂"), (1, "O₂")], [(2, "H₂O")], 1),
    ([(2, "Mg"), (1, "O₂")], [(2, "MgO")], 1),
    ([(1, "CH₄"), (2, "O₂")], [(1, "CO₂"), (2, "H₂O")], 1),
    ([(2, "Na"), (1, "Cl₂")], [(2, "NaCl")], 1),
    ([(1, "N₂"), (3, "H₂")], [(2, "NH₃")], 2),
    ([(2, "H₂O₂")], [(2, "H₂O"), (1, "O₂")], 2),
    ([(1, "Zn"), (2, "H⁺")], [(1, "Zn²⁺"), (1, "H₂")], 2),
    ([(1, "H⁺"), (1, "HO⁻")], [(1, "H₂O")], 2),
    ([(1, "CaCO₃"), (2, "H⁺")], [(1, "Ca²⁺"), (1, "CO₂"), (1, "H₂O")], 2),
    ([(4, "Fe"), (3, "O₂")], [(2, "Fe₂O₃")], 3),
    ([(4, "Al"), (3, "O₂")], [(2, "Al₂O₃")], 3),
    ([(1, "C₃H₈"), (5, "O₂")], [(3, "CO₂"), (4, "H₂O")], 3),
    ([(2, "C₂H₆"), (7, "O₂")], [(4, "CO₂"), (6, "H₂O")], 3),
    ([(1, "C₂H₆O"), (3, "O₂")], [(2, "CO₂"), (3, "H₂O")], 3),
    ([(2, "Al"), (6, "H⁺")], [(2, "Al³⁺"), (3, "H₂")], 3),
]


def parse_formula(formula: str) -> tuple[dict[str, int], int]:
    """« Fe₂O₃ » → ({"Fe": 2, "O": 3}, 0) ; « Zn²⁺ » → ({"Zn": 1}, 2)."""
    charge = 0
    match = re.search(r"([¹²³]?)([⁺⁻])$", formula)
    if match:
        size = int(match.group(1).translate(_UNSUP) or "1")
        charge = size if match.group(2) == "⁺" else -size
        formula = formula[: match.start()]
    counts: dict[str, int] = {}
    for element, digits in re.findall(r"([A-Z][a-z]?)([₀-₉]*)", formula):
        counts[element] = counts.get(element, 0) + int(digits.translate(_UNSUB) or "1")
    return counts, charge


def is_balanced(reactants: list[tuple[int, str]], products: list[tuple[int, str]]) -> bool:
    def total(side: list[tuple[int, str]]) -> tuple[dict[str, int], int]:
        counts: dict[str, int] = {}
        charge = 0
        for coef, formula in side:
            elements, q = parse_formula(formula)
            for element, n in elements.items():
                counts[element] = counts.get(element, 0) + coef * n
            charge += coef * q
        return counts, charge

    return total(reactants) == total(products)


def equation_text(reactants: list, products: list, hide: tuple[int, int] | None = None) -> str:
    def side(terms: list, index: int) -> str:
        parts = []
        for k, (coef, formula) in enumerate(terms):
            shown = "…" if hide == (index, k) else ("" if coef == 1 else str(coef))
            parts.append(f"{shown} {formula}".strip())
        return " + ".join(parts)

    return f"{side(reactants, 0)} ⟶ {side(products, 1)}"


def _equation(difficulty: int, rng: random.Random) -> dict[str, Any]:
    level = {1: (1,), 2: (1, 2), 3: (2, 3), 4: (3,), 5: (2, 3)}[difficulty]
    pool = [r for r in REACTIONS if r[2] in level]
    reactants, products, _lv = rng.choice(pool)
    hint = "Une équation ajustée a autant de chaque élément, et la même charge, de chaque côté."
    if difficulty >= 4 and rng.random() < 0.5:
        right = equation_text(reactants, products)
        wrong: list[str] = []
        sides = [list(reactants), list(products)]
        for _ in range(40):
            changed = [list(s) for s in sides]
            i = rng.randrange(2)
            k = rng.randrange(len(changed[i]))
            coef, formula = changed[i][k]
            new = max(1, coef + rng.choice([-1, 1, 2]))
            if new == coef:
                continue
            changed[i][k] = (new, formula)
            text = equation_text(changed[0], changed[1])
            if not is_balanced(changed[0], changed[1]) and text not in wrong and text != right:
                wrong.append(text)
            if len(wrong) == 3:
                break
        return _mcq("Quelle équation est correctement ajustée ?", right, wrong, hint,
                    f"Équation ajustée : {right}.", difficulty, rng, {"kind": "ajustee"})
    pool = [r for r in pool if any(c > 1 for side in r[:2] for c, _f in side)]
    reactants, products, _lv = rng.choice(pool)
    hidable = [(i, k) for i, side in enumerate((reactants, products))
               for k, (coef, _f) in enumerate(side) if coef > 1]
    i, k = rng.choice(hidable)
    coef = (reactants, products)[i][k][0]
    formula = (reactants, products)[i][k][1]
    return _numeric(
        f"Quel nombre faut-il écrire à la place de « … » pour ajuster cette équation ?\n"
        f"{equation_text(reactants, products, (i, k))}",
        coef, hint, f"Équation ajustée : {equation_text(reactants, products)} ; devant {formula} : "
        f"{coef}.", difficulty, {"kind": "coefficient", "hidden": [i, k]},
    )


EQUATION = _reg("equation", "transformations.chimique", "Ajuster une équation", _equation)


# --- Réactif limitant --------------------------------------------------------------------------

# (réactif A, réactif B, coefficients a, b) : noms des réactifs avec leur formule.
TWO_REACTANTS = [
    ("le méthane CH₄", "le dioxygène O₂", 1, 2, "CH₄ + 2 O₂ ⟶ CO₂ + 2 H₂O"),
    ("le dihydrogène H₂", "le dioxygène O₂", 2, 1, "2 H₂ + O₂ ⟶ 2 H₂O"),
    ("le carbone C", "le dioxygène O₂", 1, 1, "C + O₂ ⟶ CO₂"),
    ("le diazote N₂", "le dihydrogène H₂", 1, 3, "N₂ + 3 H₂ ⟶ 2 NH₃"),
    ("le fer Fe", "le dioxygène O₂", 4, 3, "4 Fe + 3 O₂ ⟶ 2 Fe₂O₃"),
    ("le zinc Zn", "les ions hydrogène H⁺", 1, 2, "Zn + 2 H⁺ ⟶ Zn²⁺ + H₂"),
    ("le magnésium Mg", "le dioxygène O₂", 2, 1, "2 Mg + O₂ ⟶ 2 MgO"),
    ("le propane C₃H₈", "le dioxygène O₂", 1, 5, "C₃H₈ + 5 O₂ ⟶ 3 CO₂ + 4 H₂O"),
]
STOICHIOMETRIC = "aucun : les réactifs sont dans les proportions de l'équation"


def _reactif_limitant(difficulty: int, rng: random.Random) -> dict[str, Any]:
    pool = TWO_REACTANTS if difficulty >= 3 else [t for t in TWO_REACTANTS if t[2] <= 2 and t[3] <= 2]
    name_a, name_b, a, b, equation = rng.choice(pool)
    while True:
        x_a = rng.choice([0.5, 1, 1.5, 2, 3, 4])
        n_a = x_a * a
        if difficulty == 5 and rng.random() < 0.3:
            n_b = x_a * b  # mélange stœchiométrique
        else:
            n_b = rng.choice([0.5, 1, 1.5, 2, 3, 4, 6]) * (b if difficulty >= 4 else 1)
        if n_b != x_a * b or difficulty == 5:
            break
    x_b = n_b / b
    hint = ("Divise la quantité de chaque réactif par son nombre dans l'équation : le plus petit "
            "résultat désigne le réactif limitant.")
    data = (f"On fait réagir {fr_number(n_a)} mol {_de(name_a.split(' ', 1)[1])} et "
            f"{fr_number(n_b)} mol {_de(name_b.split(' ', 1)[1])}.\n{equation}")
    meta = {"x_a": x_a, "x_b": x_b}
    if difficulty >= 4 and x_a != x_b and rng.random() < 0.5:
        x_max = min(x_a, x_b)
        excess, coef, n_excess = (name_b, b, n_b) if x_a < x_b else (name_a, a, n_a)
        left = n_excess - coef * x_max
        return _numeric(
            f"{data}\nQuelle quantité {_de(excess.split(' ', 1)[1])} reste-t-il à la fin, en "
            "moles ?",
            left, hint,
            f"{fr_number(n_a)} ÷ {a} = {fr_number(x_a)} et {fr_number(n_b)} ÷ {b} = "
            f"{fr_number(x_b)} : la réaction s'arrête à {fr_number(x_max)}. Il reste "
            f"{fr_number(n_excess)} − {coef} × {fr_number(x_max)} = {fr_number(left)} mol.",
            difficulty, {**meta, "kind": "reste"}, tolerance=0.01,
        )
    if x_a == x_b:
        right = STOICHIOMETRIC
    else:
        right = name_a if x_a < x_b else name_b
    wrong = [n for n in (name_a, name_b, STOICHIOMETRIC) if n != right]
    return _mcq(
        f"{data}\nQuel est le réactif limitant ?", right, wrong, hint,
        f"{fr_number(n_a)} ÷ {a} = {fr_number(x_a)} et {fr_number(n_b)} ÷ {b} = {fr_number(x_b)}"
        + (" : les deux réactifs sont entièrement consommés." if x_a == x_b
           else f" : le plus petit résultat désigne {right}."),
        difficulty, rng, {**meta, "kind": "limitant"},
    )


REACTIF_LIMITANT = _reg("reactif_limitant", "transformations.chimique", "Réactif limitant",
                        _reactif_limitant)


# --- Vitesse moyenne --------------------------------------------------------------------------

KMH_TO_MS = {18: 5, 36: 10, 54: 15, 72: 20, 90: 25, 108: 30, 126: 35, 144: 40}


def _vitesse_moyenne(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["ms"], 2: ["ms", "kmh_ms"], 3: ["kmh_ms", "ms_kmh", "chrono"],
             4: ["chrono", "ms_kmh", "km_min"], 5: ["chrono", "km_min", "ms_kmh"]}[difficulty]
    kind = rng.choice(kinds)
    meta = {"kind": kind}
    if kind == "ms":
        v = rng.choice([2, 3, 4, 5, 8, 10, 12])
        t = rng.choice([5, 10, 20, 25, 50])
        return _numeric(
            f"Un mobile parcourt {v * t} m en {t} s. Quelle est sa vitesse moyenne, en mètres "
            "par seconde ?", v, "Vitesse moyenne = distance ÷ durée.",
            f"v = {v * t} ÷ {t} = {v} m/s.", difficulty, meta)
    if kind == "kmh_ms":
        kmh, ms = rng.choice(list(KMH_TO_MS.items()))
        return _numeric(
            f"Une voiture roule à {kmh} km/h. Quelle est sa vitesse, en mètres par seconde ?",
            ms, "1 m/s = 3,6 km/h : pour passer des km/h aux m/s, on divise par 3,6.",
            f"{kmh} ÷ 3,6 = {ms} m/s.", difficulty, meta)
    if kind == "ms_kmh":
        kmh, ms = rng.choice(list(KMH_TO_MS.items()))
        return _numeric(
            f"Un mobile se déplace à {ms} m/s. Quelle est sa vitesse, en kilomètres par heure ?",
            kmh, "Pour passer des m/s aux km/h, on multiplie par 3,6.",
            f"{ms} × 3,6 = {kmh} km/h.", difficulty, meta)
    if kind == "chrono":
        tau = rng.choice([20, 40, 50, 100])  # ms
        v = rng.choice([0.5, 1, 1.5, 2, 2.5, 3, 4, 5])
        gap_cm = v * tau / 10
        return _numeric(
            f"Sur une chronophotographie, deux positions successives d'une balle sont séparées "
            f"de {fr_number(gap_cm)} cm. Les images sont prises toutes les {tau} ms. Quelle est "
            "la vitesse moyenne de la balle entre ces deux positions, en mètres par seconde ?",
            v, "Convertis en mètres et en secondes, puis v = distance ÷ durée.",
            f"{fr_number(gap_cm)} cm = {fr_number(gap_cm / 100)} m ; {tau} ms = "
            f"{fr_number(tau / 1000)} s ; v = {fr_number(gap_cm / 100)} ÷ {fr_number(tau / 1000)} "
            f"= {fr_number(v)} m/s.", difficulty, meta, tolerance=0.01)
    v = rng.choice([2, 3, 4, 5, 6, 10])  # m/s
    minutes = rng.choice([5, 10, 15, 20])
    km = v * minutes * 60 / 1000
    return _numeric(
        f"Un coureur parcourt {fr_number(km)} km en {minutes} min. Quelle est sa vitesse "
        "moyenne, en mètres par seconde ?", v,
        "Convertis la distance en mètres et la durée en secondes.",
        f"{fr_number(km)} km = {fr_number(km * 1000)} m ; {minutes} min = {minutes * 60} s ; "
        f"v = {fr_number(km * 1000)} ÷ {minutes * 60} = {v} m/s.", difficulty, meta,
        tolerance=0.01)


VITESSE_MOYENNE = _reg("vitesse_moyenne", "mouvement.vitesse", "Vitesse moyenne",
                       _vitesse_moyenne)


# --- Poids et gravitation ----------------------------------------------------------------------

PLANETS = [("sur la Terre", 9.8), ("sur la Lune", 1.6), ("sur Mars", 3.7)]


def _poids_gravitation(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["poids"], 2: ["poids", "masse"], 3: ["poids", "distance", "masse"],
             4: ["distance", "masses", "poids"], 5: ["les_deux", "distance", "masses"]}[difficulty]
    kind = rng.choice(kinds)
    meta = {"kind": kind}
    if kind in ("poids", "masse"):
        where, g = rng.choice(PLANETS[:1] if difficulty == 1 else PLANETS)
        kg = rng.choice([2, 5, 10, 20, 50, 60, 80] if difficulty <= 2 else [0.5, 1.5, 12, 75, 0.2])
        weight = round(kg * g, 2)
        if kind == "poids":
            return _numeric(
                f"Quel est le poids d'un objet de {fr_number(kg)} kg {where} ? On prend "
                f"g = {fr_number(g)} N/kg. Réponds en newtons.", weight, "P = m × g.",
                f"P = {fr_number(kg)} × {fr_number(g)} = {fr_number(weight)} N.", difficulty,
                meta, tolerance=0.01)
        return _numeric(
            f"Un objet pèse {fr_number(weight)} N {where} (g = {fr_number(g)} N/kg). Quelle est "
            "sa masse, en kilogrammes ?", kg, "m = P ÷ g.",
            f"m = {fr_number(weight)} ÷ {fr_number(g)} = {fr_number(kg)} kg.", difficulty, meta,
            tolerance=0.01)
    hint = ("F = G × mA × mB ÷ d² : la force est proportionnelle aux masses et inversement "
            "proportionnelle au carré de la distance.")
    if kind == "distance":
        j = rng.choice([2, 3, 4, 10])
        return _numeric(
            f"La distance entre deux astres est multipliée par {j}. Par combien la force "
            "d'attraction gravitationnelle est-elle divisée ?", j * j, hint,
            f"La force dépend de 1 ÷ d² : elle est divisée par {j} × {j} = {j * j}.",
            difficulty, meta)
    if kind == "masses":
        k = rng.choice([2, 3, 5])
        return _numeric(
            f"La masse de l'un des deux astres est multipliée par {k}, la distance ne change pas. "
            "Par combien la force d'attraction gravitationnelle est-elle multipliée ?", k, hint,
            f"La force est proportionnelle à chaque masse : multipliée par {k}.", difficulty, meta)
    k, j = rng.choice([(4, 2), (9, 3), (8, 2), (18, 3), (12, 2)])
    factor = k // (j * j)
    return _numeric(
        f"La masse d'un astre est multipliée par {k} et la distance entre les deux astres par "
        f"{j}. Par combien la force d'attraction gravitationnelle est-elle multipliée ?",
        factor, hint, f"× {k} pour la masse, ÷ {j * j} pour la distance : {k} ÷ {j * j} = {factor}.",
        difficulty, meta)


POIDS_GRAVITATION = _reg("poids_gravitation", "interactions.gravitation",
                         "Poids et gravitation", _poids_gravitation)


# --- Son : distances ----------------------------------------------------------------------------


def _distance_son(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["orage"], 2: ["orage", "echo"], 3: ["echo", "sonar", "orage_km"],
             4: ["sonar", "duree", "echo"], 5: ["sonar", "duree", "orage_km"]}[difficulty]
    kind = rng.choice(kinds)
    meta = {"kind": kind}
    if kind in ("orage", "orage_km"):
        t = rng.choice([1, 2, 3, 4, 5, 6, 9] if kind == "orage" else [1.5, 2.5, 4.5, 7, 12])
        d = 340 * t
        km = kind == "orage_km"
        return _numeric(
            f"On entend le tonnerre {fr_number(t)} s après avoir vu l'éclair. À quelle distance "
            f"est l'orage, en {'kilomètres' if km else 'mètres'} ? (son dans l'air : 340 m/s)",
            d / 1000 if km else d, "La lumière arrive presque tout de suite : d = vitesse du son × durée.",
            f"d = 340 × {fr_number(t)} = {fr_number(d)} m" + (f" = {fr_number(d / 1000)} km." if km else "."),
            difficulty, meta, tolerance=0.01)
    if kind == "echo":
        t = rng.choice([0.5, 1, 1.5, 2, 3, 4])
        d = 340 * t / 2
        return _numeric(
            f"Un randonneur crie face à une falaise et entend l'écho {fr_number(t)} s plus tard. "
            "À quelle distance est la falaise, en mètres ? (son dans l'air : 340 m/s)",
            d, "Le son fait l'aller et le retour : la distance est la moitié du trajet.",
            f"Aller-retour : 340 × {fr_number(t)} = {fr_number(2 * d)} m ; distance : "
            f"{fr_number(d)} m.", difficulty, meta, tolerance=0.01)
    if kind == "sonar":
        t = rng.choice([0.2, 0.4, 0.6, 1, 2, 4])
        d = 1500 * t / 2
        return _numeric(
            f"Le sonar d'un bateau reçoit l'écho du fond {fr_number(t)} s après l'émission. "
            "Quelle est la profondeur, en mètres ? (son dans l'eau : 1 500 m/s)",
            d, "Aller-retour : profondeur = vitesse × durée ÷ 2.",
            f"1 500 × {fr_number(t)} ÷ 2 = {fr_number(d)} m.", difficulty, meta, tolerance=0.01)
    t = rng.choice([2, 3, 5, 6, 10])
    return _numeric(
        f"Combien de temps met le son pour parcourir {340 * t} m dans l'air, en secondes ? "
        "(son dans l'air : 340 m/s)", t, "Durée = distance ÷ vitesse.",
        f"t = {340 * t} ÷ 340 = {t} s.", difficulty, meta)


DISTANCE_SON = _reg("distance_son", "son.propagation", "Distances et son", _distance_son)


# --- Période et fréquence ----------------------------------------------------------------------

PERIODS_MS = {0.5: 2000, 1: 1000, 1.25: 800, 2: 500, 2.5: 400, 4: 250, 5: 200, 8: 125, 10: 100,
              20: 50, 25: 40}
DOMAINS = ("un infrason", "un son audible", "un ultrason")


def _domain(f: float) -> str:
    return DOMAINS[0] if f < 20 else DOMAINS[2] if f > 20000 else DOMAINS[1]


def _periode_frequence(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["f"], 2: ["f", "T"], 3: ["f", "T", "periodes", "domaine"],
             4: ["periodes", "domaine", "T"], 5: ["periodes", "domaine"]}[difficulty]
    kind = rng.choice(kinds)
    t_ms, f = rng.choice(list(PERIODS_MS.items()))
    meta = {"kind": kind}
    if kind == "f":
        return _numeric(
            f"Un signal sonore a une période de {fr_number(t_ms)} ms. Quelle est sa fréquence, en "
            "hertz ?", f, "f = 1 ÷ T, avec T en secondes.",
            f"T = {fr_number(t_ms / 1000)} s ; f = 1 ÷ {fr_number(t_ms / 1000)} = {f} Hz.",
            difficulty, meta)
    if kind == "T":
        return _numeric(
            f"Un son a une fréquence de {f} Hz. Quelle est sa période, en millisecondes ?",
            t_ms, "T = 1 ÷ f : le résultat est en secondes, puis 1 s = 1 000 ms.",
            f"T = 1 ÷ {f} = {fr_number(t_ms / 1000)} s = {fr_number(t_ms)} ms.", difficulty, meta,
            tolerance=0.001)
    if kind == "periodes":
        count = rng.choice([2, 4, 5, 10])
        total = t_ms * count
        return _numeric(
            f"Sur l'écran d'un oscilloscope, {count} périodes d'un signal sonore durent "
            f"{fr_number(total)} ms. Quelle est la fréquence de ce son, en hertz ?",
            f, "Durée d'une période : durée totale ÷ nombre de périodes ; puis f = 1 ÷ T.",
            f"T = {fr_number(total)} ÷ {count} = {fr_number(t_ms)} ms = {fr_number(t_ms / 1000)} s ;"
            f" f = {f} Hz.", difficulty, meta)
    t_s = rng.choice([0.1, 0.2, 0.001, 0.0005, 0.00002, 0.00004, 0.000025])
    freq = round(1 / t_s)
    return _mcq(
        f"Un signal sonore a une période de {fr_number(t_s * 1000, 3)} ms. Que perçoit l'oreille "
        "humaine ?", _domain(freq), [d for d in DOMAINS],
        "Calcule f = 1 ÷ T. Audible : de 20 Hz à 20 000 Hz.",
        f"f = 1 ÷ {fr_number(t_s, 6)} s = {fr_number(freq)} Hz : c'est {_domain(freq)}.",
        difficulty, rng, {**meta, "f": freq},
    )


PERIODE_FREQUENCE = _reg("periode_frequence", "son.frequence", "Période et fréquence",
                         _periode_frequence)


# --- Énigme : du plus grave au plus aigu --------------------------------------------------------

# Diapasons de couleur : un nom neutre, sans fréquence attendue (un « violon à 60 Hz » tromperait).
EMITTERS = ["le diapason rouge", "le diapason bleu", "le diapason vert", "le diapason jaune",
            "le diapason violet", "le diapason blanc", "le diapason noir"]
# Fréquences données telles quelles (Hz), ou par leur période (ms) quand elle tombe juste.
SOUND_FREQUENCIES = [41, 60, 82, 110, 147, 220, 330, 440, 660, 880, 1320, 1760, 3000]
SOUND_PERIODS = {0.5: 2000, 1: 1000, 1.25: 800, 2: 500, 2.5: 400, 4: 250, 5: 200, 8: 125, 10: 100,
                 20: 50}
SONS = {1: (3, 0), 2: (3, 1), 3: (4, 2), 4: (4, 2), 5: (5, 3)}  # (sons, dont donnés par la période)
SONS_GAP = {1: 1.8, 2: 1.5, 3: 1.3, 4: 1.15, 5: 1.1}  # rapport minimal entre deux fréquences voisines


def _sons(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, by_period = SONS[difficulty]
    while True:
        periods = rng.sample(sorted(SOUND_PERIODS), by_period)
        freqs = [SOUND_PERIODS[t] for t in periods] + rng.sample(SOUND_FREQUENCIES, count - by_period)
        ordered = sorted(freqs)
        if len(set(freqs)) == count and all(b / a >= SONS_GAP[difficulty]
                                            for a, b in zip(ordered, ordered[1:], strict=False)):
            break
    names = rng.sample(EMITTERS, count)
    sounds = []
    for k, f in enumerate(freqs):
        if k < by_period:
            label = f"{names[k]} : période {fr_number(periods[k])} ms"
        else:
            label = f"{names[k]} : fréquence {f} Hz"
        sounds.append((f, label))
    sounds.sort()
    return _order(
        "Le Brouilleur a mélangé les sons du laboratoire ! Range-les du plus grave au plus aigu.",
        [label for _f, label in sounds], rng,
        "Plus la fréquence est grande, plus le son est aigu. Pour une période : f = 1 ÷ T.",
        "Du plus grave au plus aigu : " + " ; ".join(f"{label} ({f} Hz)" for f, label in sounds)
        + ".", difficulty, {"frequencies": [f for f, _l in sounds]},
    )


SONS_GEN = _reg("sons", "son.frequence", "Du grave à l'aigu", _sons)


# --- Réflexion et réfraction ------------------------------------------------------------------

MEDIA = [("l'eau", 1.33), ("le verre", 1.50), ("le plexiglas", 1.49), ("l'huile", 1.47)]



def _refraction(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["reflexion"], 2: ["reflexion", "angle"], 3: ["angle", "indice"],
             4: ["angle", "indice", "sortie"], 5: ["indice", "sortie"]}[difficulty]
    kind = rng.choice(kinds)
    hint = "Loi de Snell-Descartes : n₁ × sin(i₁) = n₂ × sin(i₂). Réflexion : angle réfléchi = angle d'incidence."
    meta = {"kind": kind}
    if kind == "reflexion":
        i1 = rng.choice([20, 30, 35, 40, 50, 65])
        return _numeric(
            f"Un rayon arrive sur un miroir plan avec un angle d'incidence de {i1} degrés. "
            "Quel est l'angle de réflexion, en degrés ?", i1, hint,
            f"L'angle de réflexion est égal à l'angle d'incidence : {i1} degrés.", difficulty, meta)
    medium, n2 = rng.choice(MEDIA[:2] if difficulty <= 3 else MEDIA)
    if kind == "sortie":
        # Du milieu vers l'air, sans réflexion totale.
        i1 = rng.choice([10, 15, 20, 25, 30])
        i2 = math.degrees(math.asin(n2 * math.sin(math.radians(i1))))
        return _numeric(
            f"Un rayon passe {_from(medium)} (n = {_idx(n2)}) dans l'air (n = 1,00) avec un "
            f"angle d'incidence de {i1} degrés. Quel est l'angle de réfraction, arrondi au degré ?",
            round(i2), hint,
            f"sin(i₂) = {_idx(n2)} × sin({i1}) ≈ {fr_number(n2 * math.sin(math.radians(i1)), 3)}"
            f", donc i₂ ≈ {round(i2)} degrés : le rayon s'écarte de la normale.",
            difficulty, {**meta, "exact": i2}, tolerance=1)
    i1 = rng.choice([20, 30, 40, 45, 50, 60])
    i2 = math.degrees(math.asin(math.sin(math.radians(i1)) / n2))
    if kind == "angle":
        return _numeric(
            f"Un rayon passe de l'air (n = 1,00) dans {medium} (n = {_idx(n2)}) avec un "
            f"angle d'incidence de {i1} degrés. Quel est l'angle de réfraction, arrondi au degré ?",
            round(i2), hint,
            f"sin(i₂) = sin({i1}) ÷ {_idx(n2)} ≈ {fr_number(math.sin(math.radians(i1)) / n2, 3)}"
            f", donc i₂ ≈ {round(i2)} degrés : le rayon se rapproche de la normale.",
            difficulty, {**meta, "exact": i2}, tolerance=1)
    shown = round(i2)
    n = math.sin(math.radians(i1)) / math.sin(math.radians(shown))
    return _numeric(
        f"Un rayon passe de l'air (n = 1,00) dans un milieu transparent. L'angle d'incidence vaut "
        f"{i1} degrés et l'angle de réfraction {shown} degrés. Quel est l'indice de ce milieu, "
        "arrondi au centième ?", round(n, 2), hint,
        f"n₂ = sin({i1}) ÷ sin({shown}) ≈ {fr_number(n, 2)}.", difficulty,
        {**meta, "exact": n}, tolerance=0.02)


def _idx(n: float) -> str:
    """Indice optique avec deux décimales : « 1,50 »."""
    return f"{n:.2f}".replace(".", ",")


def _from(medium: str) -> str:
    """« le verre » → « du verre », « l'eau » → « de l'eau »."""
    return "du " + medium[3:] if medium.startswith("le ") else "de " + medium


REFRACTION = _reg("refraction", "lumiere.refraction", "Réflexion et réfraction", _refraction)


# --- Lentille : taille de l'image -----------------------------------------------------------------

LENS_CASES = [(10, 20), (10, 30), (20, 20), (20, 60), (30, 15), (30, 60), (40, 20), (40, 120),
              (60, 30), (60, 120), (15, 30), (12, 60)]


def _image_lentille(difficulty: int, rng: random.Random) -> dict[str, Any]:
    distance_obj, distance_img = rng.choice(LENS_CASES)
    ratio = distance_img / distance_obj
    size = rng.choice([1, 2, 3, 4, 5] if difficulty <= 3 else [1.5, 2.5, 4, 6])
    hint = ("Avec le rayon qui passe par le centre optique (théorème de Thalès) : taille de "
            "l'image ÷ taille de l'objet = distance lentille-image ÷ distance lentille-objet.")
    meta = {"ratio": ratio}
    if difficulty == 1:
        k = rng.choice([2, 3, 4])
        return _numeric(
            f"L'image d'un objet de {size} cm est {k} fois plus grande que l'objet. Quelle est la "
            "taille de l'image, en centimètres ?", size * k,
            "Taille de l'image = grandissement × taille de l'objet.",
            f"{size} × {k} = {size * k} cm.", difficulty, {**meta, "kind": "simple"})
    situation = (f"Un objet est placé à {distance_obj} cm d'une lentille convergente ; son image "
                 f"nette se forme à {distance_img} cm de la lentille.")
    if difficulty == 2 or rng.random() < 0.4:
        return _numeric(
            f"{situation} Combien de fois l'image est-elle plus grande que l'objet ? (Si elle est "
            "plus petite, réponds par un nombre décimal.)", ratio, hint,
            f"{distance_img} ÷ {distance_obj} = {fr_number(ratio)}.", difficulty,
            {**meta, "kind": "grandissement"}, tolerance=0.01)
    return _numeric(
        f"{situation} L'objet mesure {fr_number(size)} cm. Quelle est la taille de l'image, en "
        "centimètres ?", size * ratio, hint,
        f"Taille de l'image = {fr_number(size)} × {distance_img} ÷ {distance_obj} = "
        f"{fr_number(size * ratio)} cm (elle est renversée).", difficulty,
        {**meta, "kind": "taille"}, tolerance=0.01)


IMAGE_LENTILLE = _reg("image_lentille", "lumiere.lentilles", "Taille d'une image",
                      _image_lentille)


# --- Circuits : nœuds et mailles -----------------------------------------------------------------


def _noeuds_mailles(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["noeud", "serie"], 2: ["noeud", "serie", "derivation"],
             3: ["noeud_ma", "serie", "derivation"], 4: ["deux_mailles", "noeud_ma", "serie3"],
             5: ["deux_mailles", "serie3", "noeud3"]}[difficulty]
    kind = rng.choice(kinds)
    meta = {"kind": kind}
    hint_n = "Loi des nœuds : la somme des intensités qui arrivent à un nœud égale la somme de celles qui en repartent."
    hint_m = "Loi des mailles : dans une boucle, la tension du générateur égale la somme des tensions des autres dipôles."
    if kind in ("noeud", "noeud_ma", "noeud3"):
        if kind == "noeud":
            total, part = rng.choice([(0.5, 0.2), (1.2, 0.4), (0.8, 0.3), (2, 0.5), (1.5, 0.9)])
            return _numeric(
                f"Un courant de {fr_number(total)} A arrive à un nœud. Il en repart {fr_number(part)} A "
                "dans une branche. Quelle intensité passe dans l'autre branche, en ampères ?",
                round(total - part, 3), hint_n, f"I = {fr_number(total)} − {fr_number(part)} = "
                f"{fr_number(total - part)} A.", difficulty, meta, tolerance=0.001)
        if kind == "noeud_ma":
            a, b = rng.choice([(120, 80), (250, 150), (60, 45), (300, 120)])
            return _numeric(
                f"Deux branches partent d'un nœud : l'une est parcourue par {a} mA, l'autre par "
                f"{b} mA. Quelle intensité arrive au nœud, en milliampères ?", a + b, hint_n,
                f"I = {a} + {b} = {a + b} mA.", difficulty, meta)
        a, b, c = rng.choice([(100, 250, 50), (40, 60, 120), (200, 150, 75)])
        total = a + b + c
        return _numeric(
            f"Un courant de {total} mA arrive à un nœud d'où partent trois branches. Deux d'entre "
            f"elles sont parcourues par {a} mA et {b} mA. Quelle intensité passe dans la troisième, "
            "en milliampères ?", c, hint_n, f"I = {total} − {a} − {b} = {c} mA.", difficulty, meta)
    if kind in ("serie", "serie3"):
        gen = rng.choice([6, 9, 12, 4.5])
        if kind == "serie":
            u1 = rng.choice([1.5, 2, 2.5, 3, 4])
            u1 = u1 if u1 < gen else 1.5
            return _numeric(
                f"Un générateur de {fr_number(gen)} V alimente une lampe et une résistance branchées "
                f"en série. La tension aux bornes de la lampe vaut {fr_number(u1)} V. Quelle est la "
                "tension aux bornes de la résistance, en volts ?", round(gen - u1, 3), hint_m,
                f"U = {fr_number(gen)} − {fr_number(u1)} = {fr_number(gen - u1)} V.", difficulty,
                meta, tolerance=0.001)
        u1, u2 = rng.choice([(1.5, 2), (2, 3), (1, 2.5)])
        gen = max(gen, 6)
        return _numeric(
            f"Un générateur de {fr_number(gen)} V alimente trois dipôles en série. Deux d'entre eux "
            f"ont à leurs bornes {fr_number(u1)} V et {fr_number(u2)} V. Quelle est la tension aux "
            "bornes du troisième, en volts ?", round(gen - u1 - u2, 3), hint_m,
            f"U = {fr_number(gen)} − {fr_number(u1)} − {fr_number(u2)} = "
            f"{fr_number(gen - u1 - u2)} V.", difficulty, meta, tolerance=0.001)
    if kind == "derivation":
        gen = rng.choice([4.5, 6, 9, 12])
        return _numeric(
            f"Deux lampes sont branchées en dérivation aux bornes d'un générateur de "
            f"{fr_number(gen)} V. Quelle est la tension aux bornes de la deuxième lampe, en volts ?",
            gen, hint_m, f"Chaque branche forme une maille avec le générateur : {fr_number(gen)} V "
            "aux bornes de chaque lampe.", difficulty, meta)
    gen, u_r = rng.choice([(9, 3), (12, 4.5), (6, 1.5), (12, 5)])
    return _numeric(
        f"Un générateur de {fr_number(gen)} V est relié à une résistance R, puis à deux lampes en "
        f"dérivation l'une de l'autre. La tension aux bornes de R vaut {fr_number(u_r)} V. Quelle est la "
        "tension aux bornes de chaque lampe, en volts ?", round(gen - u_r, 3), hint_m,
        f"Maille générateur, R, lampe : U = {fr_number(gen)} − {fr_number(u_r)} = "
        f"{fr_number(gen - u_r)} V, la même pour les deux lampes.", difficulty, meta,
        tolerance=0.001)


NOEUDS_MAILLES = _reg("noeuds_mailles", "circuits.lois", "Loi des nœuds et des mailles",
                      _noeuds_mailles)


# --- Loi d'Ohm ------------------------------------------------------------------------------------

RESISTANCES = [10, 20, 47, 50, 100, 150, 200, 220, 470, 1000]
CURRENTS_MA = [10, 20, 25, 30, 50, 100]


def _loi_ohm(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["U"], 2: ["U", "R"], 3: ["U", "R", "I"], 4: ["R", "I", "carac"],
             5: ["I", "carac", "R"]}[difficulty]
    kind = rng.choice(kinds)
    r = rng.choice(RESISTANCES)
    i_ma = rng.choice(CURRENTS_MA)
    u = r * i_ma / 1000
    hint = "Loi d'Ohm : U = R × I, avec U en volts, R en ohms et I en ampères."
    meta = {"kind": kind, "r": r, "i_ma": i_ma}
    if kind == "U":
        return _numeric(
            f"Une résistance de {r} Ω est parcourue par un courant de {i_ma} mA. Quelle est la "
            "tension à ses bornes, en volts ?", u, hint,
            f"I = {fr_number(i_ma / 1000)} A ; U = {r} × {fr_number(i_ma / 1000)} = "
            f"{fr_number(u)} V.", difficulty, meta, tolerance=0.001)
    if kind == "R":
        return _numeric(
            f"La tension aux bornes d'une résistance vaut {fr_number(u)} V quand elle est parcourue "
            f"par {i_ma} mA. Quelle est sa résistance, en ohms ?", r, hint,
            f"R = U ÷ I = {fr_number(u)} ÷ {fr_number(i_ma / 1000)} = {r} Ω.", difficulty, meta,
            tolerance=0.5)
    if kind == "I":
        return _numeric(
            f"Une résistance de {r} Ω a {fr_number(u)} V à ses bornes. Quelle intensité la "
            "traverse, en milliampères ?", i_ma, hint,
            f"I = U ÷ R = {fr_number(u)} ÷ {r} = {fr_number(i_ma / 1000)} A = {i_ma} mA.",
            difficulty, meta, tolerance=0.01)
    k = rng.choice([2, 3, 4])
    return _numeric(
        f"La caractéristique d'un conducteur ohmique est une droite qui passe par l'origine. "
        f"Pour {fr_number(u)} V, il est parcouru par {i_ma} mA. Quelle intensité le traverse "
        f"pour {fr_number(u * k)} V, en milliampères ?", i_ma * k,
        "U et I sont proportionnels : la tension est multipliée par le même nombre que "
        "l'intensité.", f"La tension est multipliée par {k} : I = {i_ma} × {k} = {i_ma * k} mA.",
        difficulty, meta, tolerance=0.01)


LOI_OHM = _reg("loi_ohm", "circuits.ohm", "Loi d'Ohm", _loi_ohm)


# --- Énigme : les échelles du monde -----------------------------------------------------------

# (objet, taille en mètres) : ordres de grandeur des manuels.
SIZES = [
    ("un noyau d'atome", 1e-15), ("un atome", 1e-10), ("un virus", 1e-7), ("une bactérie", 1e-6),
    ("un globule rouge", 7e-6), ("l'épaisseur d'un cheveu", 8e-5), ("une fourmi", 5e-3),
    ("un être humain", 1.7), ("la tour Eiffel", 330), ("le diamètre de la Terre", 1.27e7),
    ("la distance de la Terre à la Lune", 3.84e8), ("le diamètre du Soleil", 1.39e9),
    ("la distance de la Terre au Soleil", 1.5e11), ("le diamètre de la Voie lactée", 1e21),
]
ECHELLES = {1: (3, 3.0), 2: (4, 2.0), 3: (4, 1.5), 4: (5, 0.8), 5: (5, 0.5)}  # (objets, écart en log10)


def _echelles(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, gap = ECHELLES[difficulty]
    while True:
        picked = sorted(rng.sample(SIZES, count), key=lambda s: s[1])
        logs = [math.log10(s) for _n, s in picked]
        if all(b - a >= gap for a, b in zip(logs, logs[1:], strict=False)):
            break
    return _order(
        "Le Dissolveur a brouillé les échelles du monde ! Range ces objets du plus petit au plus "
        "grand.", [name for name, _s in picked], rng,
        "Pense en puissances de 10 : noyau 10⁻¹⁵ m, atome 10⁻¹⁰ m, humain 1 m, Terre 10⁷ m.",
        "Du plus petit au plus grand : " + " ; ".join(f"{name} (environ {sci(size, 2)} m)"
                                                       for name, size in picked) + ".",
        difficulty, {"sizes": [s for _n, s in picked]},
    )


ECHELLES_GEN = _reg("echelles", "atome.noyau", "Les échelles du monde", _echelles)
