"""Anglais 6e : vocabulaire du quotidien (niveau A1), une notion par thème.

Formes selon la difficulté :
1. français → anglais (QCM) ; 2. anglais → français (QCM) ;
3. écoute : le mot est prononcé en anglais (synthèse vocale), on choisit son sens ;
4. écriture : écrire le mot anglais (accents et majuscules ignorés) ;
5. dictée : écouter puis écrire le mot anglais.
Les intrus viennent du même thème (pas de devinette par élimination de thème).

Lettres mélangées (`6e.anglais.lettres`, notion « épeler et écrire ») : l'enfant remet dans
l'ordre les lettres d'un mot (traduit et prononcé, puis seulement prononcé). C'est l'énigme
de la Bibliothèque des Langues ; elle sert aussi en combat.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register

LISTEN_LANG = "en-GB"

# Thème → (titre, [(anglais, français, autres formes anglaises acceptées)]).
THEMES: dict[str, tuple[str, list[tuple[str, str, tuple[str, ...]]]]] = {
    "couleurs": (
        "les couleurs",
        [
            ("red", "rouge", ()),
            ("blue", "bleu", ()),
            ("green", "vert", ()),
            ("yellow", "jaune", ()),
            ("black", "noir", ()),
            ("white", "blanc", ()),
            ("orange", "orange", ()),
            ("pink", "rose", ()),
            ("purple", "violet", ()),
            ("brown", "marron", ()),
            ("grey", "gris", ("gray",)),
        ],
    ),
    "nombres": (
        "les nombres",
        [
            ("one", "un", ()),
            ("three", "trois", ()),
            ("five", "cinq", ()),
            ("eight", "huit", ()),
            ("ten", "dix", ()),
            ("twelve", "douze", ()),
            ("fifteen", "quinze", ()),
            ("twenty", "vingt", ()),
            ("thirty", "trente", ()),
            ("fifty", "cinquante", ()),
            ("a hundred", "cent", ("one hundred",)),
        ],
    ),
    "famille": (
        "la famille",
        [
            ("mother", "mère", ("mum", "mom")),
            ("father", "père", ("dad",)),
            ("sister", "sœur", ()),
            ("brother", "frère", ()),
            ("grandmother", "grand-mère", ("grandma",)),
            ("grandfather", "grand-père", ("grandpa",)),
            ("aunt", "tante", ()),
            ("uncle", "oncle", ()),
            ("cousin", "cousin", ()),
            ("parents", "parents", ()),
        ],
    ),
    "corps": (
        "le corps",
        [
            ("head", "tête", ()),
            ("hand", "main", ()),
            ("foot", "pied", ()),
            ("eye", "œil", ()),
            ("ear", "oreille", ()),
            ("nose", "nez", ()),
            ("mouth", "bouche", ()),
            ("arm", "bras", ()),
            ("leg", "jambe", ()),
            ("hair", "cheveux", ()),
            ("teeth", "dents", ()),
        ],
    ),
    "animaux": (
        "les animaux",
        [
            ("dog", "chien", ()),
            ("cat", "chat", ()),
            ("horse", "cheval", ()),
            ("bird", "oiseau", ()),
            ("fish", "poisson", ()),
            ("mouse", "souris", ()),
            ("rabbit", "lapin", ()),
            ("cow", "vache", ()),
            ("sheep", "mouton", ()),
            ("pig", "cochon", ()),
            ("fox", "renard", ()),
        ],
    ),
    "nourriture": (
        "la nourriture",
        [
            ("bread", "pain", ()),
            ("apple", "pomme", ()),
            ("cheese", "fromage", ()),
            ("milk", "lait", ()),
            ("water", "eau", ()),
            ("egg", "œuf", ()),
            ("chicken", "poulet", ()),
            ("rice", "riz", ()),
            ("butter", "beurre", ()),
            ("strawberry", "fraise", ()),
            ("chips", "frites", ("fries",)),
        ],
    ),
    "vetements": (
        "les vêtements",
        [
            ("shirt", "chemise", ()),
            ("trousers", "pantalon", ("pants",)),
            ("dress", "robe", ()),
            ("skirt", "jupe", ()),
            ("shoes", "chaussures", ()),
            ("hat", "chapeau", ()),
            ("coat", "manteau", ()),
            ("socks", "chaussettes", ()),
            ("jumper", "pull", ("sweater",)),
            ("scarf", "écharpe", ()),
        ],
    ),
    "ecole": (
        "l'école",
        [
            ("book", "livre", ()),
            ("pen", "stylo", ()),
            ("pencil", "crayon", ()),
            ("ruler", "règle", ()),
            ("schoolbag", "cartable", ("school bag",)),
            ("teacher", "professeur", ()),
            ("classroom", "salle de classe", ()),
            ("homework", "devoirs", ()),
            ("desk", "bureau", ()),
            ("rubber", "gomme", ("eraser",)),
            ("timetable", "emploi du temps", ()),
        ],
    ),
    "maison": (
        "la maison",
        [
            ("kitchen", "cuisine", ()),
            ("bedroom", "chambre", ()),
            ("bathroom", "salle de bains", ()),
            ("living room", "salon", ()),
            ("garden", "jardin", ()),
            ("door", "porte", ()),
            ("window", "fenêtre", ()),
            ("table", "table", ()),
            ("chair", "chaise", ()),
            ("bed", "lit", ()),
            ("stairs", "escalier", ()),
        ],
    ),
    "temps": (
        "les jours, les mois et la météo",
        [
            ("Monday", "lundi", ()),
            ("Wednesday", "mercredi", ()),
            ("Friday", "vendredi", ()),
            ("Sunday", "dimanche", ()),
            ("January", "janvier", ()),
            ("July", "juillet", ()),
            ("December", "décembre", ()),
            ("sunny", "ensoleillé", ()),
            ("rainy", "pluvieux", ()),
            ("cold", "froid", ()),
            ("windy", "venteux", ()),
        ],
    ),
    "loisirs": (
        "les sports et les loisirs",
        [
            ("football", "football", ("soccer",)),
            ("swimming", "natation", ()),
            ("cycling", "vélo", ()),
            ("reading", "lecture", ()),
            ("dancing", "danse", ()),
            ("music", "musique", ()),
            ("painting", "peinture", ()),
            ("singing", "chant", ()),
            ("tennis", "tennis", ()),
            ("video games", "jeux vidéo", ()),
            ("cinema", "cinéma", ()),
        ],
    ),
}
CHOICES = 4
TIME_MS = {1: 15000, 2: 15000, 3: 20000, 4: 25000, 5: 30000}


def _choices(words: list, target: tuple, rng: random.Random, index: int) -> tuple[list[str], int]:
    """Bonne réponse et trois intrus du même thème, mélangés (colonne 0 : anglais, 1 : français)."""
    others = [w for w in words if w[index] != target[index]]
    picked = rng.sample(others, CHOICES - 1) + [target]
    rng.shuffle(picked)
    labels = [w[index] for w in picked]
    return labels, labels.index(target[index])


def _make(theme: str):
    return vocabulary(theme, *THEMES[theme])


def vocabulary(theme: str, title: str, words: list[tuple[str, str, tuple[str, ...]]]):
    """Générateur de vocabulaire d'un thème (aussi utilisé par l'anglais de seconde)."""

    def generate(difficulty: int, rng: random.Random) -> dict[str, Any]:
        english, french, alternatives = rng.choice(words)
        hint = f"Thème : {title}."
        explanation = f"« {french} » se dit “{english}” en anglais."
        item: dict[str, Any] = {"hint": hint, "time_target_ms": TIME_MS[difficulty]}
        if difficulty == 1:
            choices, index = _choices(words, (english, french, alternatives), rng, 0)
            item |= {
                "type": "mcq",
                "prompt": f"Comment dit-on « {french} » en anglais ?",
                "choices": choices,
                "choices_lang": LISTEN_LANG,
                "answer": {"kind": "choice", "index": index},
            }
        elif difficulty in (2, 3):
            choices, index = _choices(words, (english, french, alternatives), rng, 1)
            listening = difficulty == 3
            item |= {
                "type": "mcq",
                "prompt": "Écoute le mot anglais. Que veut-il dire ?"
                if listening
                else f"Que veut dire “{english}” ?",
                "choices": choices,
                "answer": {"kind": "choice", "index": index},
            }
            if listening:
                item["listen"] = {"text": english, "lang": LISTEN_LANG}
                explanation = f"Tu as entendu “{english}”, qui veut dire « {french} »."
        else:
            dictation = difficulty == 5
            item |= {
                "type": "text",
                "prompt": "Écoute et écris le mot en anglais."
                if dictation
                else f"Écris en anglais : « {french} »",
                "answer": {"kind": "text", "value": [english, *alternatives], "accents": False},
            }
            item["hint"] = f"{hint} Le mot commence par “{english[0]}”."
            if dictation:
                item["listen"] = {"text": english, "lang": LISTEN_LANG}
                explanation = f"Le mot était “{english}” ({french})."
        item["explanation"] = explanation
        item["meta"] = {"theme": theme, "english": english, "french": french}
        return item

    return generate


GENERATORS = [
    register(
        Generator(
            code=f"6e.anglais.{theme}",
            level="6e",
            notion=f"6e.anglais.vocabulaire.{theme}",
            role="chapitre",
            title=f"Vocabulaire : {title}",
            generate=_make(theme),
        )
    )
    for theme, (title, _words) in THEMES.items()
]


# --- Énigme : les lettres mélangées -----------------------------------------------------------

# Mots d'une seule pièce, lettres toutes différentes (l'ordre attendu est alors unique).
SPELLABLE = sorted(
    {
        (english, french)
        for _title, words in THEMES.values()
        for english, french, _alt in words
        if english.isalpha() and english.islower() and len(set(english)) == len(english)
    }
)
# Difficulté → (longueurs de mot, mot français affiché).
SPELLING = {
    1: ((3, 4), True),
    2: ((4, 5), True),
    3: ((5, 6), True),
    4: ((4, 5), False),
    5: ((5, 6), False),
}


def _letters(difficulty: int, rng: random.Random) -> dict[str, Any]:
    lengths, with_french = SPELLING[difficulty]
    english, french = rng.choice([w for w in SPELLABLE if len(w[0]) in lengths])
    shown = list(range(len(english)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    prompt = (
        f"Les lettres de « {french} » en anglais se sont mélangées. Remets-les dans l'ordre."
        if with_french
        else "Écoute le mot anglais, puis remets ses lettres dans l'ordre."
    )
    return {
        "type": "order",
        "prompt": prompt,
        "choices": [english[i] for i in shown],
        "choices_lang": LISTEN_LANG,
        "listen": {"text": english, "lang": LISTEN_LANG},
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(english))]},
        "hint": f"Le mot commence par “{english[0]}”.",
        "explanation": f"Le mot était “{english}” ({french}) : “{', '.join(english)}”.",
        "time_target_ms": 20000 + 4000 * difficulty,
        "meta": {"english": english, "french": french},
    }


LETTERS = register(
    Generator(
        code="6e.anglais.lettres",
        level="6e",
        notion="6e.anglais.vocabulaire.orthographe",
        role="chapitre",
        title="Lettres mélangées",
        generate=_letters,
    )
)
