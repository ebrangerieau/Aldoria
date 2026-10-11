"""API de l'espace parent (PRD US-08 à US-11), servie uniquement sur l'hôte admin.

Chaîne de confiance (IMPLEMENTATION_PLAN §1.3) :
1. Traefik n'envoie `/api/v1/admin` vers l'API que depuis l'hôte admin, après
   TinyAuth (ForwardAuth), qui pose `Remote-User` / `Remote-Email`.
2. Ce même routeur ajoute `X-Aldoria-Admin-Key` (secret partagé). Sans lui, la route
   n'existe pas (404) : un appel qui contourne Traefik, ou qui arrive par l'hôte
   public avec un `Remote-User` forgé, est refusé.
3. L'identité doit figurer dans `ALDORIA_ADMIN_USERS` (sinon 403).
"""

from __future__ import annotations

import hmac
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.engine import tracking
from app.errors import ApiError
from app.models import Attempt, Chapter, ChapterStatus, GameSession, Notion, Profile

router = APIRouter(prefix="/admin", tags=["admin"])
Db = Annotated[AsyncSession, Depends(get_db)]

STATUSES = ("a_venir", "en_cours", "controle_bientot", "termine")
DAYS = 14


@dataclass(frozen=True)
class Parent:
    user: str
    email: str
    name: str


def parent_identity(request: Request) -> Parent:
    settings = get_settings()
    key = request.headers.get("x-aldoria-admin-key", "")
    if not settings.admin_key or not hmac.compare_digest(key.encode(), settings.admin_key.encode()):
        raise ApiError(404, "not_found", "Ressource introuvable.")
    user = request.headers.get("remote-user", "").strip()
    email = request.headers.get("remote-email", "").strip()
    name = request.headers.get("remote-name", "").strip()
    allowed = settings.admin_user_list()
    if "*" not in allowed:
        if not user and not email:
            raise ApiError(
                401, "no_identity", "Identité du parent absente : connexion SSO requise."
            )
        if user.lower() not in allowed and email.lower() not in allowed:
            raise ApiError(403, "forbidden", "Accès réservé aux parents.", identity=email or user)
    return Parent(user=user, email=email, name=name or user or email or "Parent")


CurrentParent = Annotated[Parent, Depends(parent_identity)]


# --- Schémas ------------------------------------------------------------------------


class ChapterStatusIn(BaseModel):
    status: Literal["a_venir", "en_cours", "controle_bientot", "termine"]
    test_date: date | None = None


class ProfileSettingsIn(BaseModel):
    session_max_minutes: int = Field(ge=5, le=120)


class NotionDecisionIn(BaseModel):
    in_program: bool


# --- Routes ---------------------------------------------------------------------------


@router.get("/me")
async def me(parent: CurrentParent) -> dict[str, str]:
    return {"user": parent.user, "email": parent.email, "name": parent.name}


@router.get("/profiles")
async def profiles(parent: CurrentParent, db: Db) -> list[dict[str, Any]]:
    since = datetime.now(UTC) - timedelta(days=7)
    result = []
    for p in await db.scalars(select(Profile).order_by(Profile.id)):
        week = await _activity(db, p.id, since)
        result.append({**_profile_out(p), "week": week})
    return result


@router.patch("/profiles/{profile_id}")
async def update_profile(
    profile_id: int, body: ProfileSettingsIn, parent: CurrentParent, db: Db
) -> dict[str, Any]:
    profile = await _profile(db, profile_id)
    profile.session_max_minutes = body.session_max_minutes
    await db.commit()
    return _profile_out(profile)


@router.get("/profiles/{profile_id}/dashboard")
async def dashboard(profile_id: int, parent: CurrentParent, db: Db) -> dict[str, Any]:
    """Tableau de bord : notions acquises / fragiles / non vues, temps de jeu par jour,
    dernières sessions, notions à retravailler (PRD US-10)."""
    profile = await _profile(db, profile_id)
    chapters = await tracking.progress(db, profile)
    playable = [n for ch in chapters for n in ch["notions"] if n["playable"]]
    counts = {state: 0 for state in ("acquise", "fragile", "non acquise", "non vue")}
    for n in playable:
        counts[n["state"]] += 1
    weak = sorted(
        (
            {**n, "chapter": ch["title"]}
            for ch in chapters
            for n in ch["notions"]
            if n["playable"] and n["seen"] and n["stars"] < 3
        ),
        key=lambda n: n["mastery"],
    )[:6]

    now = datetime.now(UTC)
    start = (now - timedelta(days=DAYS - 1)).date()
    sessions = await _played_sessions(db, profile.id, limit=200)
    minutes: dict[date, float] = {start + timedelta(days=i): 0.0 for i in range(DAYS)}
    for s in sessions:
        day = datetime.fromisoformat(s["started_at"]).date()
        if day in minutes:
            minutes[day] += s["seconds"] / 60
    recent = [
        {k: v for k, v in s.items() if k != "seconds"} | {"minutes": round(s["seconds"] / 60)}
        for s in sessions[:10]
    ]
    return {
        "profile": _profile_out(profile),
        "counts": counts,
        "playable": len(playable),
        "week": await _activity(db, profile.id, now - timedelta(days=7)),
        "days": [{"date": d.isoformat(), "minutes": round(m)} for d, m in minutes.items()],
        "recent_sessions": recent,
        "weak_notions": weak,
    }


@router.get("/profiles/{profile_id}/chapters")
async def chapters(profile_id: int, parent: CurrentParent, db: Db) -> list[dict[str, Any]]:
    """Programme de l'enfant : statut et date de contrôle par chapitre, étoiles par notion."""
    profile = await _profile(db, profile_id)
    rows = {
        c.code: (c, s)
        for c, s in (
            await db.execute(
                select(Chapter, ChapterStatus)
                .outerjoin(
                    ChapterStatus,
                    (ChapterStatus.chapter_id == Chapter.id)
                    & (ChapterStatus.profile_id == profile.id),
                )
                .where(Chapter.level == profile.level)
            )
        ).all()
    }
    result = []
    for ch in await tracking.progress(db, profile):
        status = rows[ch["code"]][1]
        result.append(
            {
                **ch,
                "test_date": status.test_date.isoformat() if status and status.test_date else None,
            }
        )
    return result


@router.put("/profiles/{profile_id}/chapters/{chapter_code}")
async def set_chapter_status(
    profile_id: int, chapter_code: str, body: ChapterStatusIn, parent: CurrentParent, db: Db
) -> dict[str, Any]:
    profile = await _profile(db, profile_id)
    chapter = await db.scalar(select(Chapter).where(Chapter.code == chapter_code))
    if chapter is None or chapter.level != profile.level:
        raise ApiError(404, "unknown_chapter", "Chapitre inconnu pour ce niveau.")
    status = await db.get(ChapterStatus, (profile.id, chapter.id))
    if status is None:
        status = ChapterStatus(profile_id=profile.id, chapter_id=chapter.id)
        db.add(status)
    status.status = body.status
    # La date n'a de sens que pour un contrôle annoncé.
    status.test_date = body.test_date if body.status == "controle_bientot" else None
    await db.commit()
    return {
        "code": chapter.code,
        "status": status.status,
        "test_date": status.test_date.isoformat() if status.test_date else None,
    }


@router.get("/notions/to-validate")
async def notions_to_validate(parent: CurrentParent, db: Db) -> list[dict[str, Any]]:
    """Contenus de programme incertains (sources contradictoires) : le parent tranche."""
    rows = await db.execute(
        select(Notion, Chapter)
        .join(Chapter, Notion.chapter_id == Chapter.id)
        .where(Notion.to_validate.is_(True))
        .order_by(Chapter.level, Chapter.position, Notion.id)
    )
    return [
        {
            "code": n.code,
            "label": n.label,
            "level": c.level,
            "chapter": c.title,
            "in_program": n.in_program,
        }
        for n, c in rows
    ]


@router.put("/notions/{notion_code}")
async def decide_notion(
    notion_code: str, body: NotionDecisionIn, parent: CurrentParent, db: Db
) -> dict[str, Any]:
    notion = await db.scalar(select(Notion).where(Notion.code == notion_code))
    if notion is None:
        raise ApiError(404, "unknown_notion", "Notion inconnue.")
    notion.in_program = body.in_program
    await db.commit()
    return {"code": notion.code, "in_program": notion.in_program}


# --- Aides ----------------------------------------------------------------------------


async def _profile(db: AsyncSession, profile_id: int) -> Profile:
    profile = await db.get(Profile, profile_id)
    if profile is None:
        raise ApiError(404, "unknown_profile", "Profil inconnu.")
    return profile


def _profile_out(p: Profile) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "level": p.level,
        "world": p.world,
        "avatar": p.avatar,
        "session_max_minutes": p.session_max_minutes,
    }


async def _played_sessions(
    db: AsyncSession, profile_id: int, since: datetime | None = None, limit: int = 1000
) -> list[dict[str, Any]]:
    """Sessions où l'enfant a répondu au moins une fois (une session ouverte puis
    quittée aussitôt ne compte pas), de la plus récente à la plus ancienne. Durée :
    temps actif envoyé en fin de session ; à défaut (onglet fermé), l'écart entre
    la première et la dernière réponse."""
    stats = (
        select(
            Attempt.session_id,
            func.count().label("questions"),
            func.coalesce(func.sum(cast(Attempt.correct, Integer)), 0).label("correct"),
            func.min(Attempt.answered_at).label("first"),
            func.max(Attempt.answered_at).label("last"),
        )
        .where(Attempt.profile_id == profile_id, Attempt.session_id.is_not(None))
        .group_by(Attempt.session_id)
        .subquery()
    )
    query = (
        select(GameSession, stats)
        .join(stats, stats.c.session_id == GameSession.id)
        .order_by(GameSession.started_at.desc())
        .limit(limit)
    )
    if since is not None:
        query = query.where(GameSession.started_at >= since)
    result = []
    for row in (await db.execute(query)).all():
        s: GameSession = row[0]
        span = (_aware(row.last) - _aware(row.first)).total_seconds()
        result.append(
            {
                "started_at": _aware(s.started_at).isoformat(),
                "seconds": s.active_seconds if s.active_seconds is not None else span,
                "questions": int(row.questions),
                "correct": int(row.correct),
                "finished": s.ended_at is not None,
            }
        )
    return result


async def _activity(db: AsyncSession, profile_id: int, since: datetime) -> dict[str, Any]:
    sessions = await _played_sessions(db, profile_id, since)
    answers, correct = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(cast(Attempt.correct, Integer)), 0)).where(
                Attempt.profile_id == profile_id, Attempt.answered_at >= since
            )
        )
    ).one()
    last = await db.scalar(
        select(func.max(Attempt.answered_at)).where(Attempt.profile_id == profile_id)
    )
    return {
        "sessions": len(sessions),
        "minutes": round(sum(s["seconds"] for s in sessions) / 60),
        "answers": int(answers),
        "correct": int(correct),
        "last_played": _aware(last).isoformat() if last else None,
    }


def _aware(value: datetime) -> datetime:
    """SQLite rend des dates sans fuseau : on les considère en UTC."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value
