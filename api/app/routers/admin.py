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
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.engine import accommodations, tracking
from app.engine.accommodations import Accommodations
from app.errors import ApiError
from app.models import (
    Attempt,
    Chapter,
    ChapterStatus,
    GameSession,
    Notion,
    NotionState,
    Profile,
    Report,
    SaveRevision,
)

router = APIRouter(prefix="/admin", tags=["admin"])
Db = Annotated[AsyncSession, Depends(get_db)]

STATUSES = ("a_venir", "en_cours", "controle_bientot", "termine")
DAYS = 14
WEEKS = 8


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


class RatiosIn(BaseModel):
    """Mélange d'une session (TRD §5.5) : chapitre en cours, révision, automatismes."""

    chapter: float = Field(ge=0, le=1)
    review: float = Field(ge=0, le=1)
    automatisms: float = Field(ge=0, le=1)


class ProfileSettingsIn(BaseModel):
    session_max_minutes: int | None = Field(default=None, ge=5, le=120)
    ratios: RatiosIn | None = None


class ResetIn(BaseModel):
    confirm: str = Field(max_length=40)


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
    if body.session_max_minutes is not None:
        profile.session_max_minutes = body.session_max_minutes
    if body.ratios is not None:
        r = body.ratios
        if abs(r.chapter + r.review + r.automatisms - 1) > 0.011:
            raise ApiError(422, "bad_ratios", "Les trois parts doivent faire 100 %.")
        profile.ratio_chapter = r.chapter
        profile.ratio_review = r.review
        profile.ratio_automatisms = r.automatisms
    await db.commit()
    return _profile_out(profile)


@router.put("/profiles/{profile_id}/accommodations")
async def set_accommodations(
    profile_id: int, body: Accommodations, parent: CurrentParent, db: Db
) -> dict[str, Any]:
    """Aménagements de l'enfant (accessibilité, troubles « dys »), appliqués par le jeu
    à sa prochaine connexion ou au retour au camp."""
    profile = await _profile(db, profile_id)
    profile.accommodations = body.model_dump()
    await db.commit()
    return _profile_out(profile)


@router.post("/profiles/{profile_id}/reset")
async def reset_profile(
    profile_id: int, body: ResetIn, parent: CurrentParent, db: Db
) -> dict[str, int]:
    """Réinitialisation (droit à l'effacement) : réponses, sessions, suivi des notions,
    sauvegardes et signalements de l'enfant sont supprimés. Le profil, son code et les
    statuts des chapitres restent. L'époque de sauvegarde change : un appareil qui garde
    une ancienne partie l'abandonne au lieu de la renvoyer."""
    profile = await _profile(db, profile_id)
    if body.confirm.strip().lower() != profile.name.lower():
        raise ApiError(422, "confirmation", f"Écrivez « {profile.name} » pour confirmer.")
    counts = {}
    for name, model in (
        ("attempts", Attempt),
        ("sessions", GameSession),
        ("notions", NotionState),
        ("saves", SaveRevision),
        ("reports", Report),
    ):
        result = await db.execute(delete(model).where(model.profile_id == profile.id))
        counts[name] = result.rowcount or 0
    profile.save_epoch += 1
    await db.commit()
    return counts


def _indicator(code, label, value, unit, target, met, detail) -> dict[str, Any]:
    return {
        "code": code,
        "label": label,
        "value": None if value is None else round(value, 1),
        "unit": unit,
        "target": target,
        "met": None if value is None else bool(met),
        "detail": detail,
    }


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'s' if n > 1 else ''}"


@router.get("/profiles/{profile_id}/indicators")
async def indicators(profile_id: int, parent: CurrentParent, db: Db) -> dict[str, Any]:
    """Indicateurs du PRD §2 sur les dernières semaines."""
    profile = await _profile(db, profile_id)
    now = datetime.now(UTC)
    monday = now.date() - timedelta(days=now.weekday())
    first = monday - timedelta(weeks=WEEKS - 1)
    sessions = await _played_sessions(db, profile.id, datetime.combine(first, time.min, UTC))
    weeks = [
        {"start": (first + timedelta(weeks=i)).isoformat(), "sessions": 0} for i in range(WEEKS)
    ]
    ratings = []
    for s in sessions:
        index = (datetime.fromisoformat(s["started_at"]).date() - first).days // 7
        weeks[min(max(index, 0), WEEKS - 1)]["sessions"] += 1
        if s.get("rating"):
            ratings.append(s["rating"])

    # Régularité : semaines d'affilée avec au moins 2 sessions (la semaine en cours
    # compte dès qu'elle les a atteintes).
    ordered = list(reversed(weeks))
    if ordered[0]["sessions"] < 2:
        ordered = ordered[1:]
    streak = 0
    for week in ordered:
        if week["sessions"] < 2:
            break
        streak += 1

    month_start = now - timedelta(days=28)
    month = [s for s in sessions if datetime.fromisoformat(s["started_at"]) >= month_start]
    per_session = sum(s["questions"] for s in month) / len(month) if month else None
    per_week = sum(w["sessions"] for w in weeks[-4:]) / 4

    attempts = (
        await db.execute(
            select(Attempt.notion_ids, Attempt.correct, Attempt.answered_at)
            .where(Attempt.profile_id == profile.id)
            .order_by(Attempt.answered_at)
        )
    ).all()
    exposures: dict[str, list[bool]] = {}
    for notions, correct, _ in attempts:
        if notions:
            exposures.setdefault(notions[0], []).append(bool(correct))
    measured = [e for e in exposures.values() if len(e) >= 4]
    gain = None
    if measured:
        gain = 100 * (sum(e[3] for e in measured) - sum(e[0] for e in measured)) / len(measured)

    current = set(
        await db.scalars(
            select(Chapter.code)
            .join(ChapterStatus, ChapterStatus.chapter_id == Chapter.id)
            .where(
                ChapterStatus.profile_id == profile.id,
                ChapterStatus.status.in_(("en_cours", "controle_bientot")),
            )
        )
    )
    recent = [n for n, _, at in attempts if n and _aware(at) >= month_start]
    alignment = None
    if current and recent:
        on_current = sum(1 for n in recent if n[0].rsplit(".", 1)[0] in current)
        alignment = 100 * on_current / len(recent)
    pleasure = sum(ratings) / len(ratings) if ratings else None
    alignment_detail = (
        "Part des réponses des 28 derniers jours sur les chapitres « en cours » ou "
        "« contrôle bientôt »."
        if current
        else "Aucun chapitre marqué « en cours » : à régler dans Programme."
    )
    return {
        "weeks": weeks,
        "indicators": [
            _indicator(
                "envie",
                "Sessions par semaine",
                per_week,
                "",
                "3 par semaine",
                per_week >= 3,
                "Moyenne des 4 dernières semaines (sessions avec au moins une réponse).",
            ),
            _indicator(
                "regularite",
                "Régularité",
                streak,
                "semaines",
                "6 semaines d'affilée",
                streak >= 6,
                "Semaines consécutives avec au moins 2 sessions.",
            ),
            _indicator(
                "revision",
                "Questions par session",
                per_session,
                "",
                "20 à 40",
                per_session is not None and 20 <= per_session <= 40,
                "Moyenne sur 28 jours.",
            ),
            _indicator(
                "apprentissage",
                "Progrès entre la 1re et la 4e rencontre d'une notion",
                gain,
                "points",
                "+25 points",
                gain is not None and gain >= 25,
                f"Réussite à la 4e rencontre moins réussite à la 1re, sur "
                f"{_plural(len(measured), 'notion')} rencontrée(s) au moins 4 fois.",
            ),
            _indicator(
                "alignement",
                "Questions sur le chapitre en classe",
                alignment,
                "%",
                "50 % au moins",
                alignment is not None and alignment >= 50,
                alignment_detail,
            ),
            _indicator(
                "plaisir",
                "Note de fin de donjon",
                pleasure,
                "/ 5",
                "4 ou plus",
                pleasure is not None and pleasure >= 4,
                f"Moyenne de {_plural(len(ratings), 'note')} sur {WEEKS} semaines.",
            ),
        ],
    }


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
        "accommodations": accommodations.of(p.accommodations).model_dump(),
        "ratios": {
            "chapter": p.ratio_chapter,
            "review": p.ratio_review,
            "automatisms": p.ratio_automatisms,
        },
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
                "mode": s.mode,
                "rating": s.rating,
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
