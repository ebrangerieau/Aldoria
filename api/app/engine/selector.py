"""Composition d'un paquet de session (TRD §5.5), en logique pure (testable sans base).

1. Chapitre en cours (50 %) : notions des chapitres `en_cours`, priorité aux maîtrises
   faibles. Un chapitre `controle_bientot` prend à lui seul 70 %.
   Sans chapitre en cours (le parent n'a encore rien réglé) : toutes les notions jouables.
2. Révisions espacées (30 %) : notions dont la date de révision est passée, les plus
   en retard d'abord.
3. Automatismes (20 %).
4. Difficulté : selon la maîtrise de la notion, puis ±1 pour viser 70 à 85 % de réussite
   sur les 20 dernières réponses.
5. Diversité : pas plus de 3 questions de suite sur la même notion.
Une catégorie vide cède sa place aux autres.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime

PACK_SIZE = 60
TEST_SOON_RATIO = 0.7
MAX_RUN = 3
TARGET_LOW = 0.70
TARGET_HIGH = 0.85
MIN_HISTORY = 10

CURRENT = ("en_cours", "controle_bientot")


@dataclass(frozen=True)
class NotionInfo:
    code: str
    chapter: str
    automatism: bool


@dataclass(frozen=True)
class NotionProgress:
    mastery: float = 0.0
    seen: int = 0
    due_at: datetime | None = None


@dataclass(frozen=True)
class Slot:
    notion: str
    difficulty: int
    category: str  # chapitre | revision | automatisme


def base_difficulty(mastery: float) -> int:
    """0-24 → 1, 25-49 → 2, 50-74 → 3, 75-89 → 4, 90+ → 5."""
    if mastery >= 90:
        return 5
    return 1 + int(mastery // 25)


def difficulty_shift(recent_success: list[bool]) -> int:
    if len(recent_success) < MIN_HISTORY:
        return 0
    rate = sum(recent_success) / len(recent_success)
    if rate > TARGET_HIGH:
        return 1
    if rate < TARGET_LOW:
        return -1
    return 0


def select(
    notions: list[NotionInfo],
    progress: dict[str, NotionProgress],
    chapter_status: dict[str, str],
    recent_success: list[bool],
    ratios: tuple[float, float, float],
    now: datetime,
    rng: random.Random,
    size: int = PACK_SIZE,
) -> list[Slot]:
    if not notions:
        return []
    state = {n.code: progress.get(n.code, NotionProgress()) for n in notions}
    learning = [n for n in notions if not n.automatism]
    automatisms = [n for n in notions if n.automatism]

    current = {c for c, s in chapter_status.items() if s in CURRENT}
    test_soon = {c for c, s in chapter_status.items() if s == "controle_bientot"}
    chapter_pool = [n for n in learning if n.chapter in current] or learning
    review_pool = sorted(
        (n for n in notions if state[n.code].due_at and state[n.code].due_at <= now),
        key=lambda n: state[n.code].due_at,
    )

    r_chapter, r_review, r_auto = ratios
    if test_soon:
        scale = (1 - TEST_SOON_RATIO) / max(1e-9, r_review + r_auto)
        r_chapter, r_review, r_auto = TEST_SOON_RATIO, r_review * scale, r_auto * scale
        chapter_pool = [n for n in learning if n.chapter in test_soon] or chapter_pool
    counts = _split(
        size,
        {"chapitre": r_chapter, "revision": r_review, "automatisme": r_auto},
        {"chapitre": chapter_pool, "revision": review_pool, "automatisme": automatisms},
    )

    shift = difficulty_shift(recent_success[-20:])
    slots: list[Slot] = []
    for _ in range(counts["chapitre"]):
        # Priorité aux notions les moins maîtrisées.
        weights = [1.0 + (100.0 - state[n.code].mastery) / 25.0 for n in chapter_pool]
        slots.append(_slot(rng.choices(chapter_pool, weights)[0], "chapitre", state, shift, rng))
    for i in range(counts["revision"]):
        slots.append(_slot(review_pool[i % len(review_pool)], "revision", state, shift, rng))
    for _ in range(counts["automatisme"]):
        slots.append(_slot(rng.choice(automatisms), "automatisme", state, shift, rng))
    rng.shuffle(slots)
    return _limit_runs(slots)


def _split(size: int, ratios: dict[str, float], pools: dict[str, list]) -> dict[str, int]:
    active = {k: r for k, r in ratios.items() if pools[k] and r > 0}
    if not active:  # tout est vide sauf peut-être une catégorie à ratio nul
        active = {k: 1.0 for k in pools if pools[k]}
    total = sum(active.values())
    counts = {k: int(size * r / total) for k, r in active.items()}
    leftover = size - sum(counts.values())
    for k in sorted(active, key=active.get, reverse=True)[:leftover]:
        counts[k] += 1
    return {k: counts.get(k, 0) for k in ratios}


def _slot(notion: NotionInfo, category: str, state: dict, shift: int, rng: random.Random) -> Slot:
    difficulty = base_difficulty(state[notion.code].mastery) + shift + rng.choice([-1, 0, 0, 1])
    return Slot(notion=notion.code, difficulty=max(1, min(5, difficulty)), category=category)


def _limit_runs(slots: list[Slot]) -> list[Slot]:
    """Entrelace les notions : à chaque pas, la notion qui a le plus de questions
    restantes, en évitant de répéter la précédente quand c'est possible (au-delà de
    MAX_RUN, jamais, sauf s'il ne reste plus qu'elle)."""
    queues: dict[str, list[Slot]] = {}
    for s in slots:  # l'ordre aléatoire de départ départage les égalités
        queues.setdefault(s.notion, []).append(s)
    result: list[Slot] = []
    run = 0
    while any(queues.values()):
        last = result[-1].notion if result else None
        remaining = [n for n, q in queues.items() if q]
        others = [n for n in remaining if n != last]
        if others:
            notion = max(others, key=lambda n: len(queues[n]))
            # Rester sur la même notion seulement si elle déborde nettement les autres.
            if last in remaining and run < MAX_RUN and len(queues[last]) > 2 * len(queues[notion]):
                notion = last
        else:
            notion = last
        run = run + 1 if notion == last else 1
        result.append(queues[notion].pop(0))
    return result
