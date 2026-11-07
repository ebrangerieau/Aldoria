"""Espagnol, seconde (LVB, A2+) : générateurs calculés.

- `conjugaison_present`, `conjugaison_passes`, `conjugaison_futur` : formes tirées de tables écrites
  pour les irréguliers du programme, calculées pour les verbes réguliers ;
- `lexique.<axe>` : vocabulaire des six axes culturels (mot à choisir, à écouter, à écrire) ;
- `nombres` : nombres et années (lire, écouter, écrire en lettres) ;
- `frise` : repères de l'histoire de l'Espagne et du monde hispanique à remettre dans l'ordre ;
- `frase` : phrase en miettes à remettre dans l'ordre (énigme du Moulin de la Mancha).

Réponses écrites de conjugaison : accents exigés (« hablo » n'est pas « habló ») ; le clavier du
jeu propose á, é, í, ó, ú, ñ pour l'espagnol. Vocabulaire : accents facultatifs.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register

LEVEL, SUBJECT = "2nde", "espagnol"
ES = "es-ES"
PERSONS = ["yo", "tú", "él / ella / usted", "nosotros", "vosotros", "ellos / ellas / ustedes"]
TIME_MS = {1: 15000, 2: 18000, 3: 22000, 4: 28000, 5: 32000}


# --- Conjugaison ---------------------------------------------------------------------------------

ENDINGS = {
    "présent": {"ar": ["o", "as", "a", "amos", "áis", "an"], "er": ["o", "es", "e", "emos", "éis", "en"],
                "ir": ["o", "es", "e", "imos", "ís", "en"]},
    "imparfait": {"ar": ["aba", "abas", "aba", "ábamos", "abais", "aban"],
                  "er": ["ía", "ías", "ía", "íamos", "íais", "ían"],
                  "ir": ["ía", "ías", "ía", "íamos", "íais", "ían"]},
    "passé simple": {"ar": ["é", "aste", "ó", "amos", "asteis", "aron"],
                     "er": ["í", "iste", "ió", "imos", "isteis", "ieron"],
                     "ir": ["í", "iste", "ió", "imos", "isteis", "ieron"]},
}
FUTURE = ["é", "ás", "á", "emos", "éis", "án"]
HABER = ["he", "has", "ha", "hemos", "habéis", "han"]

# Verbes réguliers à tous ces temps (ni diphtongue, ni changement orthographique) : (verbe, sens).
REGULAR = [
    ("hablar", "parler"), ("trabajar", "travailler"), ("viajar", "voyager"), ("cantar", "chanter"),
    ("mirar", "regarder"), ("escuchar", "écouter"), ("visitar", "visiter"), ("bailar", "danser"),
    ("estudiar", "étudier"), ("comer", "manger"), ("beber", "boire"), ("aprender", "apprendre"),
    ("vender", "vendre"), ("correr", "courir"), ("comprender", "comprendre"), ("vivir", "vivre"),
    ("subir", "monter"), ("recibir", "recevoir"), ("decidir", "décider"), ("partir", "partir"),
]
# Irréguliers du programme (A2+) : formes écrites une à une. Temps absents : formes régulières.
IRREGULAR: dict[str, dict[str, Any]] = {
    "ser": {"sens": "être", "présent": ["soy", "eres", "es", "somos", "sois", "son"],
            "imparfait": ["era", "eras", "era", "éramos", "erais", "eran"],
            "passé simple": ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"]},
    "estar": {"sens": "être (état, lieu)",
              "présent": ["estoy", "estás", "está", "estamos", "estáis", "están"],
              "passé simple": ["estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron"]},
    "tener": {"sens": "avoir", "présent": ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
              "passé simple": ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"],
              "futur": "tendr"},
    "ir": {"sens": "aller", "présent": ["voy", "vas", "va", "vamos", "vais", "van"],
           "imparfait": ["iba", "ibas", "iba", "íbamos", "ibais", "iban"],
           "passé simple": ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"]},
    "hacer": {"sens": "faire", "présent": ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
              "passé simple": ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"],
              "futur": "har", "participe": "hecho"},
    "decir": {"sens": "dire", "présent": ["digo", "dices", "dice", "decimos", "decís", "dicen"],
              "passé simple": ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"],
              "futur": "dir", "participe": "dicho"},
    "poder": {"sens": "pouvoir",
              "présent": ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
              "passé simple": ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"],
              "futur": "podr"},
    "querer": {"sens": "vouloir",
               "présent": ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
               "passé simple": ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"],
               "futur": "querr"},
    "venir": {"sens": "venir",
              "présent": ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
              "passé simple": ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"],
              "futur": "vendr"},
    "salir": {"sens": "sortir", "présent": ["salgo", "sales", "sale", "salimos", "salís", "salen"],
              "futur": "saldr"},
    "dar": {"sens": "donner", "présent": ["doy", "das", "da", "damos", "dais", "dan"],
            "passé simple": ["di", "diste", "dio", "dimos", "disteis", "dieron"]},
    "saber": {"sens": "savoir", "présent": ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
              "passé simple": ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"],
              "futur": "sabr"},
    "ver": {"sens": "voir", "présent": ["veo", "ves", "ve", "vemos", "veis", "ven"],
            "imparfait": ["veía", "veías", "veía", "veíamos", "veíais", "veían"],
            "passé simple": ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
            "participe": "visto"},
    "encontrar": {"sens": "trouver",
                  "présent": ["encuentro", "encuentras", "encuentra", "encontramos", "encontráis",
                              "encuentran"]},
    "empezar": {"sens": "commencer",
                "présent": ["empiezo", "empiezas", "empieza", "empezamos", "empezáis", "empiezan"]},
    "pedir": {"sens": "demander",
              "présent": ["pido", "pides", "pide", "pedimos", "pedís", "piden"]},
    "conocer": {"sens": "connaître",
                "présent": ["conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"]},
    "escribir": {"sens": "écrire", "participe": "escrito"},
    "volver": {"sens": "revenir",
               "présent": ["vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"],
               "participe": "vuelto"},
}
# Temps dont l'irrégulier a des formes à lui (les autres sont réguliers, donc déjà posés ailleurs).
TENSES = {
    "présent": ("conjugaison_present", "verbe.present"),
    "imparfait": ("conjugaison_passes", "verbe.passes"),
    "passé simple": ("conjugaison_passes", "verbe.passes"),
    "passé composé": ("conjugaison_passes", "verbe.passes"),
    "futur": ("conjugaison_futur", "verbe.futur"),
}


def conjugate(verb: str, tense: str) -> list[str]:
    """Les six formes d'un verbe à un temps (tables pour les irréguliers)."""
    special = IRREGULAR.get(verb, {})
    if tense in special and isinstance(special[tense], list):
        return list(special[tense])
    group = verb[-2:]
    stem = verb[:-2]
    if tense == "futur":
        base = special.get("futur", verb)
        return [base + e for e in FUTURE]
    if tense == "passé composé":
        participle = special.get("participe", stem + ("ado" if group == "ar" else "ido"))
        return [f"{h} {participle}" for h in HABER]
    return [stem + e for e in ENDINGS[tense][group]]


def _irregular_for(tense: str) -> list[str]:
    key = {"passé composé": "participe", "futur": "futur"}.get(tense, tense)
    return sorted(v for v, d in IRREGULAR.items() if key in d)


def _conjugation(tenses: list[str]):
    def generate(difficulty: int, rng: random.Random) -> dict[str, Any]:
        tense = rng.choice(tenses)
        irregulars = _irregular_for(tense)
        use_irregular = irregulars and (difficulty >= 3 or (difficulty == 2 and rng.random() < 0.5))
        if use_irregular:
            verb = rng.choice(irregulars)
            meaning = IRREGULAR[verb]["sens"]
        else:
            verb, meaning = rng.choice(REGULAR)
        person = rng.randrange(6)
        forms = conjugate(verb, tense)
        right = forms[person]
        prompt = (f"Conjugue “{verb}” ({meaning}) au {tense}, avec “{PERSONS[person]}”.")
        hint = {
            "présent": "Présent : -o, -as, -a, -amos, -áis, -an (-ar) ; -o, -es, -e, -emos/-imos, -éis/-ís, -en.",
            "imparfait": "Imparfait : -aba… (-ar), -ía… (-er, -ir). Irréguliers : ser (era), ir (iba), ver (veía).",
            "passé simple": "Passé simple : -é, -aste, -ó, -amos, -asteis, -aron (-ar) ; -í, -iste, -ió, -imos, -isteis, -ieron.",
            "passé composé": "Passé composé : haber au présent (he, has, ha…) + participe (-ado, -ido).",
            "futur": "Futur : infinitif + -é, -ás, -á, -emos, -éis, -án (tendr-, dir-, har-… pour les irréguliers).",
        }[tense]
        explanation = f"{PERSONS[person]} : “{right}”. Au {tense} : " + ", ".join(f"“{f}”" for f in forms) + "."
        meta = {"verb": verb, "tense": tense, "person": person, "forms": forms}
        if difficulty >= 4:
            return {
                "type": "text",
                "prompt": prompt + "\nÉcris la forme du verbe (sans le pronom).",
                "answer": {"kind": "text", "value": [right], "accents": True},
                "hint": hint,
                "explanation": explanation,
                "time_target_ms": TIME_MS[difficulty],
                "meta": meta,
            }
        wrong = [f for k, f in enumerate(forms) if k != person and f != right]
        for other in ("présent", "imparfait", "passé simple", "futur"):
            if other != tense:
                candidate = conjugate(verb, other)[person]
                if candidate != right:
                    wrong.append(candidate)
        if verb in IRREGULAR and tense in ("présent", "passé simple", "futur"):
            regularized = (conjugate("x" + verb[-2:], tense)[person][1:] if tense != "futur"
                           else verb + FUTURE[person])
            regularized = (verb[:-2] + regularized) if tense != "futur" else regularized
            if regularized != right:
                wrong.append(regularized)
        wrong = list(dict.fromkeys(w for w in wrong if w != right))
        count = 3 if difficulty == 1 else 4
        choices = rng.sample(wrong, min(count - 1, len(wrong))) + [right]
        rng.shuffle(choices)
        return {
            "type": "mcq",
            "prompt": prompt,
            "choices": choices,
            "choices_lang": ES,
            "answer": {"kind": "choice", "index": choices.index(right)},
            "hint": hint,
            "explanation": explanation,
            "time_target_ms": TIME_MS[difficulty],
            "meta": meta,
        }

    return generate


CONJUGATION = [
    register(Generator(code=f"{LEVEL}.{SUBJECT}.{name}", level=LEVEL,
                       notion=f"{LEVEL}.{SUBJECT}.{notion}", role="chapitre", title=title,
                       generate=_conjugation(tenses)))
    for name, notion, title, tenses in [
        ("conjugaison_present", "verbe.present", "Conjuguer au présent", ["présent"]),
        ("conjugaison_passes", "verbe.passes", "Conjuguer au passé",
         ["imparfait", "passé simple", "passé composé"]),
        ("conjugaison_futur", "verbe.futur", "Conjuguer au futur", ["futur"]),
    ]
]


# --- Vocabulaire des axes culturels ------------------------------------------------------------

# Axe → (titre, [(espagnol, français, autres formes espagnoles acceptées)]) : lexique A2+ du
# programme et mots courants.
LEXIQUE: dict[str, tuple[str, list[tuple[str, str, tuple[str, ...]]]]] = {
    "soi_autrui": ("soi et les autres", [
        ("el retrato", "le portrait", ("retrato",)), ("el autorretrato", "l'autoportrait", ()),
        ("la apariencia", "l'apparence", ()), ("los gustos", "les goûts", ()),
        ("la ropa", "les vêtements", ()), ("llevarse bien", "bien s'entendre", ()),
        ("la nacionalidad", "la nationalité", ()), ("el idioma", "la langue (parlée)", ("la lengua",)),
        ("los datos personales", "les données personnelles", ()), ("la relación", "la relation", ()),
        ("el amigo", "l'ami", ("la amiga",)), ("la timidez", "la timidité", ()),
        ("alto", "grand (de taille)", ("alta",)), ("delgado", "mince", ("delgada",)),
    ]),
    "generations": ("les générations", [
        ("los abuelos", "les grands-parents", ()), ("los bisabuelos", "les arrière-grands-parents", ()),
        ("los jóvenes", "les jeunes", ()), ("los ancianos", "les personnes âgées", ()),
        ("cuidar", "prendre soin de", ()), ("respetar", "respecter", ()),
        ("la convivencia", "la vie ensemble", ()), ("compartir", "partager", ()),
        ("recordar", "se souvenir", ()), ("los recuerdos", "les souvenirs", ()),
        ("la solidaridad", "la solidarité", ()), ("pedir perdón", "demander pardon", ()),
        ("el conflicto generacional", "le conflit de générations", ()), ("la familia", "la famille", ()),
    ]),
    "passe_present": ("le passé dans le présent", [
        ("el pasado", "le passé", ()), ("la historia", "l'histoire", ()),
        ("el monumento", "le monument", ()), ("el patrimonio", "le patrimoine", ()),
        ("el museo", "le musée", ()), ("la herencia", "l'héritage", ()),
        ("la fiesta", "la fête", ()), ("los días festivos", "les jours fériés", ()),
        ("celebrar", "célébrer", ()), ("transmitir", "transmettre", ()),
        ("la guerra", "la guerre", ()), ("el rey", "le roi", ()),
        ("el siglo", "le siècle", ()), ("la memoria", "la mémoire", ()),
    ]),
    "defis": ("défis et transitions", [
        ("el desafío", "le défi", ("el reto",)), ("el cambio", "le changement", ()),
        ("el calentamiento global", "le réchauffement climatique", ()),
        ("el parque eólico", "le parc éolien", ()), ("las nuevas tecnologías", "les nouvelles technologies", ()),
        ("el desarrollo sostenible", "le développement durable", ()), ("los recursos", "les ressources", ()),
        ("la ciudad", "la ville", ()), ("la juventud", "la jeunesse", ()),
        ("el medio ambiente", "l'environnement", ()), ("la desigualdad", "l'inégalité", ()),
        ("reciclar", "recycler", ()), ("la contaminación", "la pollution", ()),
        ("el turismo", "le tourisme", ()),
    ]),
    "creer": ("créer et recréer", [
        ("el arte", "l'art", ()), ("la pintura", "la peinture", ()), ("el cuadro", "le tableau", ()),
        ("la moda", "la mode", ()), ("el diseñador", "le créateur de mode", ("la diseñadora",)),
        ("el boceto", "l'esquisse", ()), ("la leyenda", "la légende", ()),
        ("el cuento", "le conte", ()), ("crear", "créer", ()), ("inventar", "inventer", ()),
        ("el cine", "le cinéma", ()), ("la obra", "l'œuvre", ()),
        ("el pintor", "le peintre", ("la pintora",)), ("el escritor", "l'écrivain", ("la escritora",)),
    ]),
    "espagne": ("l'Espagne au-delà des clichés", [
        ("el mar", "la mer", ()), ("la costa", "la côte", ()), ("el puerto", "le port", ()),
        ("la montaña", "la montagne", ()), ("el campo", "la campagne", ()),
        ("el paisaje", "le paysage", ()), ("la playa", "la plage", ()), ("la arena", "le sable", ()),
        ("las olas", "les vagues", ()), ("echar la siesta", "faire la sieste", ()),
        ("los tópicos", "les clichés", ("los clichés",)), ("la tierra", "la terre", ()),
        ("el pueblo", "le village", ()), ("la sierra", "la chaîne de montagnes", ()),
    ]),
}


def _vocabulary(theme: str, title: str, words: list[tuple[str, str, tuple[str, ...]]]):
    def generate(difficulty: int, rng: random.Random) -> dict[str, Any]:
        spanish, french, alternatives = rng.choice(words)
        hint = f"Thème : {title}."
        explanation = f"« {french} » se dit “{spanish}” en espagnol."
        item: dict[str, Any] = {"hint": hint, "time_target_ms": TIME_MS[difficulty]}
        column = 0 if difficulty == 1 else 1
        others = rng.sample([w for w in words if w[column] != (spanish, french)[column]], 3)
        picked = others + [(spanish, french, alternatives)]
        rng.shuffle(picked)
        labels = [w[column] for w in picked]
        if difficulty == 1:
            item |= {"type": "mcq", "prompt": f"Comment dit-on « {french} » en espagnol ?",
                     "choices": labels, "choices_lang": ES,
                     "answer": {"kind": "choice", "index": labels.index(spanish)}}
        elif difficulty in (2, 3):
            listening = difficulty == 3
            item |= {"type": "mcq",
                     "prompt": "Écoute le mot espagnol. Que veut-il dire ?" if listening
                     else f"Que veut dire “{spanish}” ?",
                     "choices": labels, "answer": {"kind": "choice", "index": labels.index(french)}}
            if listening:
                item["listen"] = {"text": spanish, "lang": ES}
                explanation = f"Tu as entendu “{spanish}”, qui veut dire « {french} »."
        else:
            dictation = difficulty == 5
            bare = spanish.split(" ", 1)[1] if spanish.split(" ", 1)[0] in ("el", "la", "los", "las") else spanish
            item |= {"type": "text",
                     "prompt": "Écoute et écris le mot en espagnol." if dictation
                     else f"Écris en espagnol : « {french} »",
                     "answer": {"kind": "text", "value": list(dict.fromkeys([spanish, bare, *alternatives])),
                                "accents": False}}
            item["hint"] = f"{hint} Le mot commence par “{bare[0]}”."
            if dictation:
                item["listen"] = {"text": spanish, "lang": ES}
                explanation = f"Le mot était “{spanish}” ({french})."
        item["explanation"] = explanation
        item["meta"] = {"theme": theme, "spanish": spanish, "french": french}
        return item

    return generate


LEXIQUE_GENERATORS = [
    register(Generator(code=f"{LEVEL}.{SUBJECT}.lexique.{theme}", level=LEVEL,
                       notion=f"{LEVEL}.{SUBJECT}.lexique.{theme}", role="chapitre",
                       title=f"Vocabulaire : {title}", generate=_vocabulary(theme, title, words)))
    for theme, (title, words) in LEXIQUE.items()
]


# --- Nombres et dates ------------------------------------------------------------------------------

_UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
          "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho",
          "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
          "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"]
_TENS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta",
         9: "noventa"}
_HUNDREDS = {1: "ciento", 2: "doscientos", 3: "trescientos", 4: "cuatrocientos", 5: "quinientos",
             6: "seiscientos", 7: "setecientos", 8: "ochocientos", 9: "novecientos"}


def number_words(n: int) -> str:
    """Nombre en lettres (forme masculine, comme pour compter), de 0 à 9 999."""
    if n < 30:
        return _UNITS[n]
    if n < 100:
        tens, unit = divmod(n, 10)
        return _TENS[tens] + (f" y {_UNITS[unit]}" if unit else "")
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        if n == 100:
            return "cien"
        return _HUNDREDS[hundreds] + (f" {number_words(rest)}" if rest else "")
    thousands, rest = divmod(n, 1000)
    head = "mil" if thousands == 1 else f"{number_words(thousands)} mil"
    return head + (f" {number_words(rest)}" if rest else "")


YEARS = [1492, 1605, 1808, 1936, 1975, 1978, 1992, 2010, 2024, 2026]


def _nombres(difficulty: int, rng: random.Random) -> dict[str, Any]:
    hint = "Jusqu'à 30 : un seul mot (veintidós). Ensuite : treinta y uno. Cent : cien ; 101 : ciento uno."
    if difficulty in (1, 3):
        n = rng.randint(11, 29) if difficulty == 1 else rng.randint(101, 999)
        right = number_words(n)
        wrong = {number_words(m) for m in (n + 1, n - 1, n + 10, n - 10, n + 100) if 0 < m < 1000} - {right}
        choices = rng.sample(sorted(wrong), 3) + [right]
        rng.shuffle(choices)
        return {"type": "mcq", "prompt": f"Comment dit-on {n} en espagnol ?", "choices": choices,
                "choices_lang": ES, "answer": {"kind": "choice", "index": choices.index(right)},
                "hint": hint, "explanation": f"{n} : “{right}”.", "time_target_ms": TIME_MS[difficulty],
                "meta": {"n": n, "words": right}}
    if difficulty in (2, 4):
        n = rng.randint(31, 99) if difficulty == 2 else rng.choice(YEARS + [rng.randint(1500, 2030)])
        words = number_words(n)
        return {"type": "numeric", "prompt": "Écoute le nombre en espagnol et écris-le en chiffres.",
                "listen": {"text": words, "lang": ES},
                "answer": {"kind": "number", "value": str(n)}, "hint": hint,
                "explanation": f"Tu as entendu “{words}” : {n}.", "time_target_ms": TIME_MS[difficulty],
                "meta": {"n": n, "words": words}}
    n = rng.randint(31, 99)
    words = number_words(n)
    plain = words.replace("é", "e").replace("ó", "o")
    return {"type": "text", "prompt": f"Écris {n} en lettres, en espagnol.",
            "answer": {"kind": "text", "value": list(dict.fromkeys([words, plain])), "accents": False},
            "hint": hint, "explanation": f"{n} : “{words}”.", "time_target_ms": TIME_MS[difficulty],
            "meta": {"n": n, "words": words}}


NOMBRES = register(Generator(code=f"{LEVEL}.{SUBJECT}.nombres", level=LEVEL,
                             notion=f"{LEVEL}.{SUBJECT}.lexique.nombres", role="chapitre",
                             title="Nombres et dates", generate=_nombres))


# --- Frise du monde hispanique -------------------------------------------------------------------

EVENTS = [
    (711, "Arrivée des musulmans dans la péninsule Ibérique (début d'Al-Andalus)"),
    (1492, "Prise de Grenade et premier voyage de Christophe Colomb"),
    (1605, "Publication de la première partie de Don Quichotte"),
    (1656, "Velázquez peint Les Ménines"),
    (1808, "Soulèvement du Dos de Mayo à Madrid contre les troupes de Napoléon"),
    (1810, "Début de la guerre d'indépendance du Mexique"),
    (1936, "Début de la guerre civile espagnole"),
    (1937, "Picasso peint Guernica"),
    (1975, "Mort de Franco, fin de la dictature"),
    (1978, "Adoption de la Constitution démocratique espagnole"),
    (1986, "Entrée de l'Espagne dans la Communauté européenne"),
    (1992, "Jeux olympiques de Barcelone et Exposition universelle de Séville"),
]
FRISE = {1: (3, 100), 2: (3, 40), 3: (4, 20), 4: (4, 5), 5: (5, 1)}


def _frise(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, gap = FRISE[difficulty]
    while True:
        picked = sorted(rng.sample(EVENTS, count))
        if all(b[0] - a[0] >= gap for a, b in zip(picked, picked[1:], strict=False)):
            break
    labels = [label for _y, label in picked]
    shown = list(labels)
    while shown == labels:
        rng.shuffle(shown)
    return {"type": "order",
            "prompt": "Remets ces événements dans l'ordre chronologique, du plus ancien au plus récent.",
            "choices": shown, "answer": {"kind": "order", "value": [shown.index(x) for x in labels]},
            "hint": "Repères : 711, 1492, 1605, 1936-1939, 1975, 1978.",
            "explanation": "Dans l'ordre : " + " ; ".join(f"{y} : {label}" for y, label in picked) + ".",
            "time_target_ms": 30000 + 8000 * difficulty, "meta": {"years": [y for y, _l in picked]}}


FRISE_GEN = register(Generator(code=f"{LEVEL}.{SUBJECT}.frise", level=LEVEL,
                               notion=f"{LEVEL}.{SUBJECT}.culture.reperes", role="chapitre",
                               title="La frise du monde hispanique", generate=_frise))


# --- Phrases en miettes (énigme du Moulin de la Mancha) -------------------------------------------

# Mots tous différents (un seul ordre), majuscule au premier mot, ponctuation sur le dernier ; la
# traduction lève toute ambiguïté de sens.
SENTENCES: list[tuple[tuple[str, ...], str]] = [
    (("Me", "gusta", "mucho", "el", "cine."), "J'aime beaucoup le cinéma."),
    (("Mañana", "vamos", "a", "la", "playa."), "Demain, nous allons à la plage."),
    (("Mi", "hermano", "es", "muy", "alto."), "Mon frère est très grand."),
    (("Hoy", "hace", "mucho", "calor", "aquí."), "Aujourd'hui, il fait très chaud ici."),
    (("Tengo", "que", "estudiar", "para", "el", "examen."), "Je dois étudier pour l'examen."),
    (("Ayer", "visitamos", "el", "museo", "del", "Prado."), "Hier, nous avons visité le musée du Prado."),
    (("Mis", "abuelos", "viven", "en", "un", "pueblo."), "Mes grands-parents vivent dans un village."),
    (("¿Dónde", "está", "la", "estación", "de", "tren?"), "Où est la gare ?"),
    (("Cuando", "era", "niña,", "vivía", "en", "Sevilla."), "Quand j'étais petite, je vivais à Séville."),
    (("Hay", "que", "proteger", "el", "medio", "ambiente."), "Il faut protéger l'environnement."),
    (("Los", "jóvenes", "están", "jugando", "al", "fútbol."), "Les jeunes sont en train de jouer au football."),
    (("Quiero", "que", "vengas", "conmigo", "al", "concierto."), "Je veux que tu viennes avec moi au concert."),
    (("El", "año", "pasado", "viajé", "a", "México."), "L'année dernière, j'ai voyagé au Mexique."),
    (("Mi", "hermana", "es", "más", "alta", "que", "yo."), "Ma sœur est plus grande que moi."),
    (("A", "mis", "padres", "les", "encanta", "bailar", "salsa."), "Mes parents adorent danser la salsa."),
    (("Picasso", "pintó", "Guernica", "en", "mil", "novecientos", "treinta", "y", "siete."),
     "Picasso a peint Guernica en 1937."),
    (("En", "verano", "suelo", "echar", "la", "siesta", "después", "de", "comer."),
     "En été, j'ai l'habitude de faire la sieste après le repas."),
    (("Si", "hace", "buen", "tiempo,", "iremos", "al", "campo."),
     "S'il fait beau, nous irons à la campagne."),
]
SENTENCE_LENGTHS = {1: (5, 5), 2: (5, 6), 3: (6, 7), 4: (7, 7), 5: (7, 9)}


def _frase(difficulty: int, rng: random.Random) -> dict[str, Any]:
    low, high = SENTENCE_LENGTHS[difficulty]
    words, french = rng.choice([s for s in SENTENCES if low <= len(s[0]) <= high])
    shown = list(range(len(words)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    sentence = " ".join(words)
    return {"type": "order",
            "prompt": f"L'Enredador a emmêlé cette phrase ! Remets les mots dans l'ordre pour dire : « {french} »",
            "choices": [words[i] for i in shown], "choices_lang": ES,
            "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(words))]},
            "hint": f"La phrase commence par “{words[0]}”.", "explanation": f"La phrase : “{sentence}”",
            "time_target_ms": 20000 + 5000 * difficulty, "meta": {"sentence": sentence, "french": french}}


FRASE = register(Generator(code=f"{LEVEL}.{SUBJECT}.frase", level=LEVEL,
                           notion=f"{LEVEL}.{SUBJECT}.phrase.ordre", role="chapitre",
                           title="Les phrases emmêlées", generate=_frase))
