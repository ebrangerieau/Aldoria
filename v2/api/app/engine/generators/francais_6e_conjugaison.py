"""Français, 6e : conjugaison calculée (programme du cycle 3, BO n° 16 du 17 avril 2025).

Verbes du programme : être, avoir, premier et deuxième groupes, et les verbes irréguliers
faire, aller, dire, venir, pouvoir, voir, vouloir, prendre. Temps : présent, imparfait, passé
simple, futur, conditionnel présent, impératif présent, passé composé, plus-que-parfait.

Les formes des verbes irréguliers sont écrites en entier (relues) ; celles des verbes réguliers
sont calculées, avec les variations du radical en -cer et -ger (« nous mangeons », « il lança »).
Les verbes conjugués avec « être » aux temps composés ne sont demandés qu'aux personnes dont le
genre se voit (il, elle, ils, elles) : « elle est venue », « ils sont allés ».

Deux générateurs :
- conjuguer : « Conjugue prendre au passé simple, avec ils. » (propositions : la même personne aux
  autres temps ; difficulté 5 : forme à écrire) ;
- reconnaître le temps : « Nous prendrions : à quel temps ? » (jamais une forme commune à deux temps,
  comme « je finis », présent et passé simple).
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register

PERSONS = ("je", "tu", "il", "nous", "vous", "ils")
# Personnes affichées : « il » ou « elle », « ils » ou « elles » au hasard.
SHOWN = {2: ("il", "elle"), 5: ("ils", "elles")}

PRESENT = "présent"
IMPARFAIT = "imparfait"
PASSE_SIMPLE = "passé simple"
FUTUR = "futur"
CONDITIONNEL = "conditionnel présent"
IMPERATIF = "impératif présent"
PASSE_COMPOSE = "passé composé"
PLUS_QUE_PARFAIT = "plus-que-parfait"
TENSES = (
    PRESENT,
    IMPARFAIT,
    PASSE_SIMPLE,
    FUTUR,
    CONDITIONNEL,
    IMPERATIF,
    PASSE_COMPOSE,
    PLUS_QUE_PARFAIT,
)
# Temps nommés dans les questions : indicatif sauf impératif et conditionnel.
TENSE_LABEL = {
    PRESENT: "présent de l'indicatif",
    IMPARFAIT: "imparfait de l'indicatif",
    PASSE_SIMPLE: "passé simple de l'indicatif",
    FUTUR: "futur de l'indicatif",
    CONDITIONNEL: "conditionnel présent",
    IMPERATIF: "impératif présent",
    PASSE_COMPOSE: "passé composé de l'indicatif",
    PLUS_QUE_PARFAIT: "plus-que-parfait de l'indicatif",
}

# Verbes irréguliers : présent, passé simple et impératif en entier ; radicaux de l'imparfait et
# du futur (le conditionnel prend le radical du futur) ; participe passé et auxiliaire.
IRREGULAR: dict[str, dict[str, Any]] = {
    "être": {
        PRESENT: ("suis", "es", "est", "sommes", "êtes", "sont"),
        PASSE_SIMPLE: ("fus", "fus", "fut", "fûmes", "fûtes", "furent"),
        IMPERATIF: ("sois", "soyons", "soyez"),
        "imparfait": "ét",
        "futur": "ser",
        "participe": "été",
        "aux": "avoir",
    },
    "avoir": {
        PRESENT: ("ai", "as", "a", "avons", "avez", "ont"),
        PASSE_SIMPLE: ("eus", "eus", "eut", "eûmes", "eûtes", "eurent"),
        IMPERATIF: ("aie", "ayons", "ayez"),
        "imparfait": "av",
        "futur": "aur",
        "participe": "eu",
        "aux": "avoir",
    },
    "faire": {
        PRESENT: ("fais", "fais", "fait", "faisons", "faites", "font"),
        PASSE_SIMPLE: ("fis", "fis", "fit", "fîmes", "fîtes", "firent"),
        IMPERATIF: ("fais", "faisons", "faites"),
        "imparfait": "fais",
        "futur": "fer",
        "participe": "fait",
        "aux": "avoir",
    },
    "aller": {
        PRESENT: ("vais", "vas", "va", "allons", "allez", "vont"),
        PASSE_SIMPLE: ("allai", "allas", "alla", "allâmes", "allâtes", "allèrent"),
        IMPERATIF: ("va", "allons", "allez"),
        "imparfait": "all",
        "futur": "ir",
        "participe": "allé",
        "aux": "être",
    },
    "dire": {
        PRESENT: ("dis", "dis", "dit", "disons", "dites", "disent"),
        PASSE_SIMPLE: ("dis", "dis", "dit", "dîmes", "dîtes", "dirent"),
        IMPERATIF: ("dis", "disons", "dites"),
        "imparfait": "dis",
        "futur": "dir",
        "participe": "dit",
        "aux": "avoir",
    },
    "venir": {
        PRESENT: ("viens", "viens", "vient", "venons", "venez", "viennent"),
        PASSE_SIMPLE: ("vins", "vins", "vint", "vînmes", "vîntes", "vinrent"),
        IMPERATIF: ("viens", "venons", "venez"),
        "imparfait": "ven",
        "futur": "viendr",
        "participe": "venu",
        "aux": "être",
    },
    "pouvoir": {
        PRESENT: ("peux", "peux", "peut", "pouvons", "pouvez", "peuvent"),
        PASSE_SIMPLE: ("pus", "pus", "put", "pûmes", "pûtes", "purent"),
        IMPERATIF: None,  # pas d'impératif
        "imparfait": "pouv",
        "futur": "pourr",
        "participe": "pu",
        "aux": "avoir",
    },
    "voir": {
        PRESENT: ("vois", "vois", "voit", "voyons", "voyez", "voient"),
        PASSE_SIMPLE: ("vis", "vis", "vit", "vîmes", "vîtes", "virent"),
        IMPERATIF: ("vois", "voyons", "voyez"),
        "imparfait": "voy",
        "futur": "verr",
        "participe": "vu",
        "aux": "avoir",
    },
    "vouloir": {
        PRESENT: ("veux", "veux", "veut", "voulons", "voulez", "veulent"),
        PASSE_SIMPLE: ("voulus", "voulus", "voulut", "voulûmes", "voulûtes", "voulurent"),
        IMPERATIF: None,  # impératif rare (« veuillez ») : pas demandé
        "imparfait": "voul",
        "futur": "voudr",
        "participe": "voulu",
        "aux": "avoir",
    },
    "prendre": {
        PRESENT: ("prends", "prends", "prend", "prenons", "prenez", "prennent"),
        PASSE_SIMPLE: ("pris", "pris", "prit", "prîmes", "prîtes", "prirent"),
        IMPERATIF: ("prends", "prenons", "prenez"),
        "imparfait": "pren",
        "futur": "prendr",
        "participe": "pris",
        "aux": "avoir",
    },
}
FIRST_GROUP = (
    "chanter",
    "parler",
    "marcher",
    "danser",
    "regarder",
    "aimer",
    "jouer",
    "manger",
    "nager",
    "commencer",
    "lancer",
)
SECOND_GROUP = ("finir", "choisir", "grandir", "réussir", "obéir")
IRREGULAR_VERBS = tuple(IRREGULAR)
ALL_VERBS = IRREGULAR_VERBS + FIRST_GROUP + SECOND_GROUP

IMPARFAIT_ENDINGS = ("ais", "ais", "ait", "ions", "iez", "aient")
FUTUR_ENDINGS = ("ai", "as", "a", "ons", "ez", "ont")
COND_ENDINGS = IMPARFAIT_ENDINGS
IMPERATIVE_PERSONS = (1, 3, 4)  # tu, nous, vous


def group(verb: str) -> int:
    if verb in SECOND_GROUP:
        return 2
    if verb in FIRST_GROUP:
        return 1
    return 3 if verb not in ("être", "avoir") else 0


def _soften(stem: str, ending: str) -> str:
    """-cer et -ger : « ç » ou « ge » devant a et o (nous mangeons, il lança)."""
    if ending[:1] in ("a", "o", "â"):
        if stem.endswith("c"):
            return stem[:-1] + "ç" + ending
        if stem.endswith("g"):
            return stem + "e" + ending
    return stem + ending


def _simple(verb: str, tense: str) -> tuple[str, ...] | None:
    """Les six formes (trois à l'impératif) d'un temps simple, sans pronom."""
    if verb in IRREGULAR:
        data = IRREGULAR[verb]
        if tense in (PRESENT, PASSE_SIMPLE, IMPERATIF):
            return data[tense]
        if tense == IMPARFAIT:
            return tuple(data["imparfait"] + e for e in IMPARFAIT_ENDINGS)
        if tense == FUTUR:
            return tuple(data["futur"] + e for e in FUTUR_ENDINGS)
        if tense == CONDITIONNEL:
            return tuple(data["futur"] + e for e in COND_ENDINGS)
        return None
    if verb in SECOND_GROUP:
        stem = verb[:-2]  # fin-
        forms = {
            PRESENT: ("is", "is", "it", "issons", "issez", "issent"),
            IMPARFAIT: tuple("iss" + e for e in IMPARFAIT_ENDINGS),
            PASSE_SIMPLE: ("is", "is", "it", "îmes", "îtes", "irent"),
            FUTUR: tuple("ir" + e for e in FUTUR_ENDINGS),
            CONDITIONNEL: tuple("ir" + e for e in COND_ENDINGS),
            IMPERATIF: ("is", "issons", "issez"),
        }[tense]
        return tuple(stem + e for e in forms)
    stem = verb[:-2]  # chant-
    endings = {
        PRESENT: ("e", "es", "e", "ons", "ez", "ent"),
        IMPARFAIT: IMPARFAIT_ENDINGS,
        PASSE_SIMPLE: ("ai", "as", "a", "âmes", "âtes", "èrent"),
        IMPERATIF: ("e", "ons", "ez"),
    }
    if tense in endings:
        return tuple(_soften(stem, e) for e in endings[tense])
    if tense == FUTUR:
        return tuple(verb + e for e in FUTUR_ENDINGS)
    if tense == CONDITIONNEL:
        return tuple(verb + e for e in COND_ENDINGS)
    return None


def participle(verb: str) -> str:
    if verb in IRREGULAR:
        return IRREGULAR[verb]["participe"]
    return verb[:-2] + ("i" if verb in SECOND_GROUP else "é")


def auxiliary(verb: str) -> str:
    return IRREGULAR[verb]["aux"] if verb in IRREGULAR else "avoir"


def _agree(part: str, shown: str) -> str:
    """Participe passé conjugué avec « être » : accord avec le sujet affiché."""
    if shown == "elle":
        return part + "e"
    if shown == "ils":
        return part + "s"
    if shown == "elles":
        return part + "es"
    return part


def form(verb: str, tense: str, person: int, shown: str) -> str | None:
    """Forme conjuguée sans pronom ; None si elle n'existe pas ou n'est pas demandée."""
    if tense == IMPERATIF:
        if person not in IMPERATIVE_PERSONS:
            return None
        forms = _simple(verb, IMPERATIF)
        return None if forms is None else forms[IMPERATIVE_PERSONS.index(person)]
    if tense in (PASSE_COMPOSE, PLUS_QUE_PARFAIT):
        aux = auxiliary(verb)
        if aux == "être" and person not in (2, 5):
            return None  # genre invisible avec je, tu, nous, vous
        aux_tense = PRESENT if tense == PASSE_COMPOSE else IMPARFAIT
        aux_form = _simple(aux, aux_tense)[person]  # type: ignore[index]
        part = participle(verb)
        if aux == "être":
            part = _agree(part, shown)
        return f"{aux_form} {part}"
    forms = _simple(verb, tense)
    return None if forms is None else forms[person]


def with_pronoun(conjugated: str, person: int, shown: str, tense: str) -> str:
    """« je prends », « j'avais », « elles prirent » ; l'impératif sans pronom (« Prenez ! »)."""
    if tense == IMPERATIF:
        return conjugated[0].upper() + conjugated[1:] + " !"
    if shown == "je" and conjugated[:1] in "aeéèêiouy":
        return "j'" + conjugated
    return f"{shown} {conjugated}"


def _shown(person: int, rng: random.Random) -> str:
    return rng.choice(SHOWN[person]) if person in SHOWN else PERSONS[person]


# Difficulté → verbes et temps proposés.
VERBS_BY_DIFFICULTY = {
    1: ("être", "avoir") + FIRST_GROUP[:7],
    2: ("être", "avoir") + FIRST_GROUP + SECOND_GROUP,
    3: ALL_VERBS,
    4: ALL_VERBS,
    5: ALL_VERBS,
}
TENSES_BY_DIFFICULTY = {
    1: (PRESENT, IMPARFAIT, FUTUR),
    2: (PRESENT, IMPARFAIT, FUTUR, PASSE_COMPOSE),
    3: (PRESENT, IMPARFAIT, FUTUR, PASSE_SIMPLE, CONDITIONNEL, IMPERATIF),
    4: TENSES,
    5: TENSES,
}


def _draw(difficulty: int, rng: random.Random) -> tuple[str, str, int, str, str]:
    """Verbe, temps, personne, pronom affiché, forme conjuguée (existante)."""
    while True:
        verb = rng.choice(VERBS_BY_DIFFICULTY[difficulty])
        tense = rng.choice(TENSES_BY_DIFFICULTY[difficulty])
        person = rng.choice(IMPERATIVE_PERSONS if tense == IMPERATIF else range(6))
        shown = _shown(person, rng)
        conjugated = form(verb, tense, person, shown)
        if conjugated is not None:
            return verb, tense, person, shown, conjugated


def _person_label(person: int, shown: str, tense: str) -> str:
    if tense == IMPERATIF:
        return {1: "à la 2e personne du singulier", 3: "à la 1re personne du pluriel",
                4: "à la 2e personne du pluriel"}[person]
    return f"avec « {shown} »"


def _conjuguer(difficulty: int, rng: random.Random) -> dict[str, Any]:
    verb, tense, person, shown, conjugated = _draw(difficulty, rng)
    answer = with_pronoun(conjugated, person, shown, tense)
    prompt = f"Conjugue « {verb} » au {TENSE_LABEL[tense]}, {_person_label(person, shown, tense)}."
    aux_note = ""
    if tense in (PASSE_COMPOSE, PLUS_QUE_PARFAIT):
        aux_note = (
            f" Auxiliaire « {auxiliary(verb)} » au "
            f"{'présent' if tense == PASSE_COMPOSE else 'imparfait'} + participe passé « {participle(verb)} »."
        )
    item: dict[str, Any] = {
        "hint": _hint(tense),
        "explanation": f"« {verb} » au {TENSE_LABEL[tense]} : {answer}.{aux_note}",
        "time_target_ms": 15000 + 4000 * difficulty,
        "meta": {"verb": verb, "tense": tense, "person": person},
    }
    if difficulty == 5:
        bare = answer.rstrip(" !")
        forms = [answer, bare, conjugated]
        return item | {
            "type": "text",
            "prompt": f"{prompt}\nÉcris le verbe conjugué.",
            "answer": {"kind": "text", "value": list(dict.fromkeys(forms)), "accents": True},
        }
    # Intrus : la même personne aux autres temps (des formes justes, mais pas de ce temps).
    others: list[str] = []
    for other in TENSES:
        if other == tense or (other == IMPERATIF) != (tense == IMPERATIF):
            continue
        alt = form(verb, other, person, shown)
        if alt is None:
            continue
        shown_alt = with_pronoun(alt, person, shown, other)
        if shown_alt != answer and shown_alt not in others:
            others.append(shown_alt)
    if tense == IMPERATIF:  # l'impératif n'a qu'un temps : intrus pris au présent
        alt = form(verb, PRESENT, person, shown)
        others = [f"{PERSONS[person]} {alt}"] if alt else []
        others += [with_pronoun(f, person, shown, IMPERATIF) for f in _wrong_imperatives(verb, person)]
    count = 3 if difficulty == 1 else 4
    picked = rng.sample(others, min(count - 1, len(others))) + [answer]
    rng.shuffle(picked)
    return item | {
        "type": "mcq",
        "prompt": prompt,
        "choices": picked,
        "answer": {"kind": "choice", "index": picked.index(answer)},
    }


def _wrong_imperatives(verb: str, person: int) -> list[str]:
    """Erreurs fréquentes à l'impératif : « chantes » (avec -s), forme d'une autre personne."""
    forms = _simple(verb, IMPERATIF) or ()
    wrong = [f for i, f in enumerate(forms) if IMPERATIVE_PERSONS[i] != person]
    if person == 1 and verb in FIRST_GROUP:
        wrong.append(forms[0] + "s")
    return wrong


def _hint(tense: str) -> str:
    return {
        PRESENT: "Présent : ce qui se passe maintenant (« je chante », « nous finissons »).",
        IMPARFAIT: "Imparfait : terminaisons -ais, -ais, -ait, -ions, -iez, -aient.",
        PASSE_SIMPLE: "Passé simple : temps du récit (« il chanta », « ils finirent », « elle prit »).",
        FUTUR: "Futur : l'infinitif ou un radical en -r, puis -ai, -as, -a, -ons, -ez, -ont.",
        CONDITIONNEL: "Conditionnel présent : radical du futur et terminaisons de l'imparfait (« je chanterais »).",
        IMPERATIF: "Impératif : un ordre, sans pronom, à trois personnes (« Chante ! Chantons ! Chantez ! »).",
        PASSE_COMPOSE: "Passé composé : auxiliaire au présent + participe passé (« j'ai chanté », « elle est venue »).",
        PLUS_QUE_PARFAIT: "Plus-que-parfait : auxiliaire à l'imparfait + participe passé (« j'avais chanté »).",
    }[tense]


def _all_displayed(verb: str) -> dict[str, set[str]]:
    """Chaque forme affichée du verbe → temps où on la trouve (pour écarter « je finis »)."""
    found: dict[str, set[str]] = {}
    for tense in TENSES:
        persons = IMPERATIVE_PERSONS if tense == IMPERATIF else range(6)
        for person in persons:
            for shown in SHOWN.get(person, (PERSONS[person],)):
                conj = form(verb, tense, person, shown)
                if conj is not None:
                    found.setdefault(with_pronoun(conj, person, shown, tense), set()).add(tense)
    return found


def _reconnaitre(difficulty: int, rng: random.Random) -> dict[str, Any]:
    while True:
        verb, tense, person, shown, conjugated = _draw(difficulty, rng)
        shown_form = with_pronoun(conjugated, person, shown, tense)
        if _all_displayed(verb)[shown_form] == {tense}:
            break
    pool = [t for t in TENSES_BY_DIFFICULTY[max(difficulty, 3)] if t != tense]
    count = 3 if difficulty == 1 else 4
    picked = rng.sample(pool, count - 1) + [tense]
    rng.shuffle(picked)
    return {
        "type": "mcq",
        "prompt": f"« {shown_form} » : à quel temps ce verbe est-il conjugué ?",
        "choices": picked,
        "answer": {"kind": "choice", "index": picked.index(tense)},
        "hint": _hint(tense),
        "explanation": f"« {shown_form} » : « {verb} » au {TENSE_LABEL[tense]}.",
        "time_target_ms": 15000 + 3000 * difficulty,
        "meta": {"verb": verb, "tense": tense, "form": shown_form},
    }


CONJUGUER = register(
    Generator(
        code="6e.francais.conjugaison.formes",
        level="6e",
        notion="6e.francais.conjugaison.formes",
        role="chapitre",
        title="Conjuguer un verbe",
        generate=_conjuguer,
    )
)
RECONNAITRE = register(
    Generator(
        code="6e.francais.conjugaison.reconnaitre",
        level="6e",
        notion="6e.francais.conjugaison.reconnaitre",
        role="chapitre",
        title="Reconnaître un temps",
        generate=_reconnaitre,
    )
)
