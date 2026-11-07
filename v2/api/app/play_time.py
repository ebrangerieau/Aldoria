"""Temps de jeu de la séance en cours (durée maximale fixée par le parent, PRD US-11).

Une séance regroupe les sessions de jeu (donjon, arène, village, défi) qui se suivent ;
une pause d'au moins `BREAK_MINUTES` sans jouer en ouvre une nouvelle. Calculé ici, à
partir des sessions enregistrées, pour que la limite soit la même sur tous les appareils
et qu'un rechargement de la page ne la remette pas à zéro.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts import aware, utcnow
from app.models import Attempt, GameSession, Profile

BREAK_MINUTES = 30
# Une séance ne remonte pas plus loin (borne de la requête).
LOOKBACK = timedelta(hours=12)


async def seance(db: AsyncSession, profile_id: int, now: datetime | None = None) -> tuple[int, int]:
    """(secondes jouées dans la séance en cours, secondes écoulées depuis la dernière activité).

    Séance terminée (pause assez longue, ou rien joué) : (0, écart).
    """
    now = now or utcnow()
    sessions = list(
        await db.scalars(
            select(GameSession)
            .where(GameSession.profile_id == profile_id, GameSession.started_at >= now - LOOKBACK)
            .order_by(GameSession.started_at.desc())
        )
    )
    # Session jamais terminée (onglet fermé, réseau coupé) : jouée jusqu'à sa dernière réponse.
    open_ids = [s.id for s in sessions if s.ended_at is None]
    last_answer: dict[str, datetime] = {}
    if open_ids:
        rows = await db.execute(
            select(Attempt.session_id, func.max(Attempt.answered_at))
            .where(Attempt.session_id.in_(open_ids))
            .group_by(Attempt.session_id)
        )
        last_answer = {sid: aware(at) for sid, at in rows.all() if at is not None}
    pause = timedelta(minutes=BREAK_MINUTES)
    played = 0.0
    idle: float | None = None
    boundary = now
    for s in sessions:
        started = aware(s.started_at)
        ended = aware(s.ended_at) or max(last_answer.get(s.id, started), started)
        ended = min(ended, now)  # heure d'un appareil en avance
        if boundary - ended >= pause:
            break
        if idle is None:
            idle = (now - ended).total_seconds()
        if s.active_seconds is not None:
            played += s.active_seconds
        else:
            played += (ended - started).total_seconds()
        boundary = started
    if idle is None:
        return 0, int(BREAK_MINUTES * 60)
    return int(played), int(idle)


async def info(db: AsyncSession, profile: Profile) -> dict[str, Any]:
    """Ce que le jeu doit savoir pour appliquer la limite (connexion, camp, session)."""
    played, idle = await seance(db, profile.id)
    return {
        "played_seconds": played,
        "idle_seconds": idle,
        "session_max_minutes": profile.session_max_minutes,
        "break_minutes": BREAK_MINUTES,
    }
