"""Score de maîtrise par notion (TRD §5.4) : moyenne mobile exponentielle, 0 à 100.

    gain = 1 si juste, 0 si faux
    gain × 0,6 si indice utilisé
    gain × facteur_temps (1 si temps ≤ cible, décroît jusqu'à 0,7 à 3 × la cible)
    maîtrise = maîtrise × (1 − α) + 100 × gain × α, avec α = 0,25 × (0,6 + 0,1 × difficulté)

Étoiles d'Archives : 0 = jamais vue, 1 = non acquis (< 40), 2 = fragile (40-74),
3 = acquis (≥ 75).
"""

from __future__ import annotations

HINT_FACTOR = 0.6
SLOW_FLOOR = 0.7
FRAGILE_FROM = 40.0
ACQUIRED_FROM = 75.0


def time_factor(time_ms: int, target_ms: int) -> float:
    if target_ms <= 0 or time_ms <= target_ms:
        return 1.0
    ratio = min(time_ms / target_ms, 3.0)
    return 1.0 - (1.0 - SLOW_FLOOR) * (ratio - 1.0) / 2.0


def update(
    mastery: float, correct: bool, hint_used: bool, time_ms: int, target_ms: int, difficulty: int
) -> float:
    gain = 1.0 if correct else 0.0
    if hint_used:
        gain *= HINT_FACTOR
    gain *= time_factor(time_ms, target_ms)
    alpha = 0.25 * (0.6 + 0.1 * difficulty)
    return max(0.0, min(100.0, mastery * (1 - alpha) + 100.0 * gain * alpha))


def stars(mastery: float, seen: int) -> int:
    if seen == 0:
        return 0
    if mastery < FRAGILE_FROM:
        return 1
    if mastery < ACQUIRED_FROM:
        return 2
    return 3


def label(mastery: float, seen: int) -> str:
    return ["non vue", "non acquise", "fragile", "acquise"][stars(mastery, seen)]
