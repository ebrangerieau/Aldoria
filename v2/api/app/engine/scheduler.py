"""Répétition espacée (TRD §5.3), isolée derrière l'interface `Scheduler` pour pouvoir
passer à FSRS plus tard sans toucher au reste.

| Boîte | Prochaine présentation |
| 1     | même session (côté client) puis 1 jour |
| 2     | 3 jours  |
| 3     | 7 jours  |
| 4     | 21 jours |
| 5     | 60 jours |

- Juste sans indice : boîte + 1.
- Juste avec indice : boîte inchangée.
- Faux : retour en boîte 1 (le client la repropose dans la session sous une autre forme).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

INTERVAL_DAYS = {1: 1, 2: 3, 3: 7, 4: 21, 5: 60}
MAX_BOX = 5


@dataclass(frozen=True)
class Review:
    box: int
    due_at: datetime


class Scheduler(Protocol):
    def review(self, box: int, correct: bool, hint_used: bool, at: datetime) -> Review: ...


class LeitnerScheduler:
    def review(self, box: int, correct: bool, hint_used: bool, at: datetime) -> Review:
        if not correct:
            new_box = 1
        elif hint_used:
            new_box = box
        else:
            new_box = min(MAX_BOX, box + 1)
        return Review(box=new_box, due_at=at + timedelta(days=INTERVAL_DAYS[new_box]))
