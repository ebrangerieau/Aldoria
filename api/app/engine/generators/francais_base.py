"""Français : moteur commun des générateurs à base d'exemples relus.

En français, une règle « calculée » se trompe vite (exceptions, usages, sens). Chaque notion
s'appuie donc sur une liste d'exemples écrits et relus (`Fact`), dont la bonne réponse se
vérifie à la lecture du fichier. Le moteur tire un exemple selon la difficulté, choisit les
intrus et, pour le vocabulaire de l'analyse (figures, termes du théâtre…), demande d'écrire
le mot à la difficulté 5.

Difficulté → niveau des exemples et nombre de propositions :
1 → niveau 1, 3 propositions ; 2 → niveaux 1-2, 4 ; 3 → niveau 2, 4 ; 4 → niveaux 2-3, 4 ;
5 → niveau 3, réponse écrite si la notion le permet (accents et majuscules ignorés), sinon 4.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from app.engine.generators import Generator, register

LEVELS = {1: (1,), 2: (1, 2), 3: (2,), 4: (2, 3), 5: (3,)}
CHOICES = {1: 3, 2: 4, 3: 4, 4: 4, 5: 4}
TIME_MS = {1: 20000, 2: 25000, 3: 30000, 4: 35000, 5: 40000}


@dataclass(frozen=True)
class Fact:
    """Un exemple : énoncé, bonne réponse, explication ; `wrong` : intrus propres à
    l'exemple (sinon pris dans le vocabulaire de la notion) ; `accepted` : autres formes
    écrites acceptées."""

    level: int
    prompt: str
    answer: str
    explanation: str
    wrong: tuple[str, ...] = ()
    accepted: tuple[str, ...] = ()


@dataclass(frozen=True)
class Notion:
    code: str  # fin du code de notion et du générateur : « langue.classes_mots »
    title: str
    hint: str
    facts: list[Fact]
    pool: tuple[str, ...] = ()  # réponses possibles de la notion (intrus par défaut)
    writable: bool = False  # difficulté 5 : réponse à écrire
    extra: dict[str, Any] = field(default_factory=dict)


def _pick(notion: Notion, difficulty: int, rng: random.Random) -> Fact:
    wanted = LEVELS[difficulty]
    facts = [f for f in notion.facts if f.level in wanted]
    if not facts:  # notion sans exemple de ce niveau : le plus proche
        nearest = min(
            {f.level for f in notion.facts}, key=lambda lv: min(abs(lv - w) for w in wanted)
        )
        facts = [f for f in notion.facts if f.level == nearest]
    return rng.choice(facts)


def _choices(notion: Notion, fact: Fact, count: int, rng: random.Random) -> tuple[list[str], int]:
    others = [w for w in fact.wrong if w != fact.answer]
    if len(others) < count - 1:
        others += [p for p in notion.pool if p != fact.answer and p not in others]
    picked = rng.sample(others, min(count - 1, len(others))) + [fact.answer]
    rng.shuffle(picked)
    return picked, picked.index(fact.answer)


def make(notion: Notion):
    def generate(difficulty: int, rng: random.Random) -> dict[str, Any]:
        fact = _pick(notion, difficulty, rng)
        item: dict[str, Any] = {
            "hint": notion.hint,
            "explanation": fact.explanation,
            "time_target_ms": TIME_MS[difficulty],
            "meta": {"notion": notion.code, "answer": fact.answer},
        }
        if difficulty == 5 and notion.writable:
            forms = [fact.answer, *fact.accepted]
            # « métaphore », « une métaphore », « la métaphore » : toutes justes.
            forms += [
                f"{article}{w}"
                for w in forms[:2]
                for article in ("une ", "un ", "la ", "le ", "l'")
            ]
            item |= {
                "type": "text",
                "prompt": f"{fact.prompt}\nÉcris ta réponse.",
                "answer": {
                    "kind": "text",
                    "value": list(dict.fromkeys(forms))[:10],
                    "accents": False,
                },
            }
        else:
            choices, index = _choices(notion, fact, CHOICES[difficulty], rng)
            item |= {
                "type": "mcq",
                "prompt": fact.prompt,
                "choices": choices,
                "answer": {"kind": "choice", "index": index},
            }
        return item

    return generate


def register_notions(level: str, subject: str, notions: list[Notion]) -> list[Generator]:
    return [
        register(
            Generator(
                code=f"{level}.{subject}.{n.code}",
                level=level,
                notion=f"{level}.{subject}.{n.code}",
                role="chapitre",
                title=n.title,
                generate=make(n),
            )
        )
        for n in notions
    ]
