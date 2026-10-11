"""API côté joueur (TRD §3.2) : profils, connexion, session, tentatives, progression."""

from __future__ import annotations

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentProfile, create_token, verify_pin
from app.config import get_settings
from app.db import get_db
from app.engine import tracking
from app.engine.generators import REGISTRY
from app.errors import ApiError
from app.models import Attempt, Chapter, GameSession, Profile

router = APIRouter(prefix="/play", tags=["play"])
Db = Annotated[AsyncSession, Depends(get_db)]


# --- Schémas ----------------------------------------------------------------------


class ProfileOut(BaseModel):
    id: int
    name: str
    avatar: str
    level: str
    world: str


class LoginIn(BaseModel):
    profile_id: int
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class LoginOut(BaseModel):
    token: str
    expires_at: datetime
    profile: ProfileOut


class EnigmaIn(BaseModel):
    generator: str = Field(max_length=80)
    count: int = Field(default=3, ge=1, le=12)


class SessionStartIn(BaseModel):
    """Paramètres d'un donjon (tous facultatifs : l'arène s'en passe)."""

    focus_chapter: str | None = Field(default=None, max_length=80)
    enigma: EnigmaIn | None = None


class SessionStartOut(BaseModel):
    session_id: str
    items: list[dict[str, Any]]
    formulas: dict[str, str]
    start_levels: dict[str, int]
    settings: dict[str, Any]


class AttemptIn(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None = None
    item_id: str = Field(max_length=120)
    generator: str | None = Field(default=None, max_length=80)
    difficulty: int = Field(ge=1, le=5)
    notion_ids: list[str] = Field(max_length=10)
    correct: bool
    time_ms: int = Field(ge=0, le=3_600_000)
    time_target_ms: int | None = Field(default=None, ge=1000, le=600_000)
    hint_used: bool = False
    game_mode: str = Field(default="combat", max_length=20)
    answered_at: datetime


class AttemptsIn(BaseModel):
    attempts: list[AttemptIn] = Field(max_length=500)


class AttemptsOut(BaseModel):
    accepted: int
    duplicates: int


class SaveIn(BaseModel):
    base_revision: int = Field(ge=0)
    schema_version: int = Field(ge=1, le=1000)
    data: dict[str, Any]


class SaveOut(BaseModel):
    revision: int
    schema_version: int | None = None
    data: dict[str, Any] | None = None
    saved_at: datetime | None = None


MAX_SAVE_BYTES = 64 * 1024


class SessionEndIn(BaseModel):
    session_id: uuid.UUID
    active_seconds: int = Field(ge=0, le=24 * 3600)


# --- Routes -----------------------------------------------------------------------


def _profile_out(p: Profile) -> ProfileOut:
    return ProfileOut(id=p.id, name=p.name, avatar=p.avatar, level=p.level, world=p.world)


@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(db: Db) -> list[ProfileOut]:
    rows = await db.scalars(select(Profile).order_by(Profile.id))
    return [_profile_out(p) for p in rows]


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: Db) -> LoginOut:
    settings = get_settings()
    profile = await db.get(Profile, body.profile_id)
    if profile is None:
        raise ApiError(404, "unknown_profile", "Profil inconnu.")
    now = datetime.now(UTC)
    locked_until = _aware(profile.locked_until)
    if locked_until and locked_until > now:
        raise ApiError(
            423,
            "locked",
            "Trop d'essais. Attends un peu avant de réessayer.",
            retry_after_s=int((locked_until - now).total_seconds()) + 1,
        )
    if not verify_pin(profile.pin_hash, body.pin):
        profile.failed_logins += 1
        remaining = settings.max_failed_logins - profile.failed_logins
        if remaining <= 0:
            profile.failed_logins = 0
            profile.locked_until = now + timedelta(minutes=settings.lock_minutes)
            await db.commit()
            raise ApiError(
                423,
                "locked",
                "Trop d'essais. Attends un peu avant de réessayer.",
                retry_after_s=settings.lock_minutes * 60,
            )
        await db.commit()
        raise ApiError(401, "wrong_pin", "Code incorrect.", remaining_attempts=remaining)
    profile.failed_logins = 0
    profile.locked_until = None
    await db.commit()
    token, expires = create_token(profile.id)
    return LoginOut(token=token, expires_at=expires, profile=_profile_out(profile))


@router.post("/session/start", response_model=SessionStartOut)
async def start_session(
    profile: CurrentProfile, db: Db, body: SessionStartIn | None = None
) -> SessionStartOut:
    body = body or SessionStartIn()
    enigma = None
    if body.enigma is not None:
        generator = REGISTRY.get(body.enigma.generator)
        if generator is None or generator.level != profile.level:
            raise ApiError(422, "unknown_generator", "Énigme inconnue pour ce niveau.")
        enigma = (generator, body.enigma.count)
    if body.focus_chapter is not None:
        chapter = await db.scalar(select(Chapter).where(Chapter.code == body.focus_chapter))
        if chapter is None or chapter.level != profile.level:
            raise ApiError(422, "unknown_chapter", "Chapitre inconnu pour ce niveau.")
    session = GameSession(id=str(uuid.uuid4()), profile_id=profile.id)
    db.add(session)
    await db.commit()
    pack = await tracking.build_pack(db, profile, random.Random(), body.focus_chapter, enigma)
    return SessionStartOut(
        session_id=session.id,
        items=pack["items"],
        formulas=pack["formulas"],
        start_levels=pack["start_levels"],
        settings={"session_max_minutes": profile.session_max_minutes},
    )


@router.post("/attempts", response_model=AttemptsOut)
async def post_attempts(body: AttemptsIn, profile: CurrentProfile, db: Db) -> AttemptsOut:
    """Idempotent : une tentative déjà reçue (même UUID) est ignorée (TRD §2.7)."""
    ids = [str(a.id) for a in body.attempts]
    existing = set(await db.scalars(select(Attempt.id).where(Attempt.id.in_(ids))))
    session_ids = {str(a.session_id) for a in body.attempts if a.session_id}
    if session_ids:
        owned = set(
            await db.scalars(
                select(GameSession.id).where(
                    GameSession.id.in_(session_ids), GameSession.profile_id == profile.id
                )
            )
        )
        if session_ids - owned:
            raise ApiError(403, "foreign_session", "Session inconnue pour ce profil.")
    accepted = 0
    seen: set[str] = set()
    new_attempts: list[dict[str, Any]] = []
    for a in body.attempts:
        key = str(a.id)
        if key in existing or key in seen:
            continue
        seen.add(key)
        db.add(
            Attempt(
                id=key,
                profile_id=profile.id,
                session_id=str(a.session_id) if a.session_id else None,
                item_id=a.item_id,
                generator=a.generator,
                difficulty=a.difficulty,
                notion_ids=a.notion_ids,
                correct=a.correct,
                time_ms=a.time_ms,
                hint_used=a.hint_used,
                game_mode=a.game_mode,
                answered_at=a.answered_at,
            )
        )
        new_attempts.append(a.model_dump())
        accepted += 1
    # Leitner + maîtrise, une seule fois par tentative (les doublons sont écartés plus haut).
    await tracking.apply_attempts(db, profile.id, new_attempts)
    await db.commit()
    return AttemptsOut(accepted=accepted, duplicates=len(body.attempts) - accepted)


@router.get("/progress")
async def get_progress(profile: CurrentProfile, db: Db) -> dict[str, Any]:
    """Maîtrise par notion, groupée par chapitre (étoiles d'Archives)."""
    return {"chapters": await tracking.progress(db, profile)}


@router.get("/save", response_model=SaveOut)
async def get_save(profile: CurrentProfile, db: Db) -> SaveOut:
    current = await tracking.latest_save(db, profile.id)
    return SaveOut(revision=0) if current is None else _save_out(current)


@router.put("/save", response_model=SaveOut)
async def put_save(body: SaveIn, profile: CurrentProfile, db: Db) -> SaveOut:
    """Sauvegarde versionnée : `base_revision` = révision sur laquelle s'appuie le client.
    Conflit (un autre appareil a sauvegardé une partie plus avancée) : 409, avec la
    sauvegarde du serveur dans `details.current`, que le client adopte."""
    if len(json.dumps(body.data)) > MAX_SAVE_BYTES:
        raise ApiError(413, "save_too_large", "Sauvegarde trop volumineuse.")
    accepted, saved = await tracking.store_save(
        db, profile.id, body.base_revision, body.schema_version, body.data
    )
    if not accepted:
        raise ApiError(
            409,
            "save_conflict",
            "Une partie plus avancée existe sur un autre appareil.",
            current=_save_out(saved).model_dump(mode="json"),
        )
    return _save_out(saved)


def _save_out(saved: Any) -> SaveOut:
    return SaveOut(
        revision=saved.revision,
        schema_version=saved.schema_version,
        data=saved.data,
        saved_at=saved.saved_at,
    )


@router.post("/session/end")
async def end_session(body: SessionEndIn, profile: CurrentProfile, db: Db) -> dict[str, int]:
    session = await db.get(GameSession, str(body.session_id))
    if session is None or session.profile_id != profile.id:
        raise ApiError(404, "unknown_session", "Session inconnue.")
    total, correct = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(cast(Attempt.correct, Integer)), 0)).where(
                Attempt.session_id == session.id
            )
        )
    ).one()
    session.ended_at = datetime.now(UTC)
    session.active_seconds = body.active_seconds
    session.nb_questions = int(total)
    session.nb_correct = int(correct)
    await db.commit()
    return {"nb_questions": session.nb_questions, "nb_correct": session.nb_correct}


def _aware(value: datetime | None) -> datetime | None:
    """SQLite rend des dates sans fuseau : on les considère en UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value
